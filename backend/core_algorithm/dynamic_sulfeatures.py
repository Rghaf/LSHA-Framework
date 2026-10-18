"""
dynamic_sulfeatures.py — the platform's own SystemUnderLearning.

Why this file exists
--------------------
``sha_learning/domain/sulfeatures.py`` lives in the pinned ``lsha`` submodule and
must stay pristine — editing it makes the submodule dirty and the change is lost
on the next submodule update. This module therefore keeps the platform's only
divergence from upstream in code we own.

The divergence is a **performance** fix, not a behavioural one.
``SystemUnderLearning.get_segments`` slices the main signal with a linear scan:

    segment = [pt for pt in main_sig.points
               if start_timestamp <= pt.timestamp.to_secs() < end_timestamp]

That is O(n) per call with a ``to_secs()`` conversion per point. It is called
once per trace per observation-table cell, so on CSV case studies — where a
single trace carries tens of thousands of samples — it dominates the run
(ENERGY was taking ~9 minutes).

``CustomSignal`` in ``tasks.py`` already attaches a pre-sorted ``_secs`` list
alongside the points, precisely so this lookup can be a binary search. That hook
was being computed and then ignored. The override below uses it, reducing each
call to O(log n + segment_size), and falls back to the upstream linear scan for
any signal without ``_secs`` (e.g. the UPPAAL path), so results are unchanged.

Only ``get_segments`` is overridden; everything else is inherited, so upstream
fixes to the rest of the class still reach us.
"""

import bisect
import os
import time
from typing import List

# Lightweight instrumentation, off unless LSHA_PROFILE_SEGMENTS=1. Counts how
# often the fast path is actually taken and how much wall time get_segments
# costs, so a claim that the optimisation "works" can be checked rather than
# assumed.
_PROFILE = os.environ.get('LSHA_PROFILE_SEGMENTS') == '1'
_STATS = {'calls': 0, 'fast': 0, 'slow': 0, 'seconds': 0.0, 'points': 0}


def segment_stats():
    return dict(_STATS)

from core_algorithm.lsha.sha_learning.domain.lshafeatures import (  # noqa: F401
    RealValuedVar,
)
from core_algorithm.lsha.sha_learning.domain.sigfeatures import Timestamp
from core_algorithm.lsha.sha_learning.domain.sulfeatures import (
    SystemUnderLearning as _UpstreamSUL,
)


class SystemUnderLearning(_UpstreamSUL):
    """Upstream SUL with a binary-search ``get_segments``."""

    def get_segments(self, word):
        _t0 = time.perf_counter() if _PROFILE else None
        traces: List[int] = [i for i, t in enumerate(self.traces) if t.startswith(word)]
        if len(traces) == 0:
            return []

        segments = []
        for trace in traces:
            main_sig_index = [
                i for i, s in enumerate(self.signals[0])
                if s.label == self.vars[0].label
            ][0]
            main_sig = self.signals[trace][main_sig_index]

            if word != '' and str(word) != 'ε':
                start_timestamp = self.timed_traces[trace].t[max(len(word) - 1, 0)].to_secs()
            else:
                start_timestamp = Timestamp(0, 0, 0, 0, 0, 0).to_secs()

            if len(word) < len(self.timed_traces[trace]):
                end_timestamp = self.timed_traces[trace].t[len(word)].to_secs()
            else:
                end_timestamp = main_sig.points[-1].timestamp.to_secs()

            # Fast path: CustomSignal (tasks.py) builds its points from a
            # time-sorted DataFrame and caches the seconds in `_secs`, so the
            # window [start, end) can be located by binary search instead of a
            # full scan. Semantically identical to the fallback below.
            secs = getattr(main_sig, '_secs', None)
            if secs is not None:
                lo = bisect.bisect_left(secs, start_timestamp)
                hi = bisect.bisect_left(secs, end_timestamp)
                segment = main_sig.points[lo:hi]
            else:
                segment = [
                    pt for pt in main_sig.points
                    if start_timestamp <= pt.timestamp.to_secs() < end_timestamp
                ]
            segments.append(segment)
            if _PROFILE:
                _STATS['points'] += len(main_sig.points)
                if secs is not None:
                    _STATS['fast'] += 1
                else:
                    _STATS['slow'] += 1

        if _PROFILE:
            _STATS['calls'] += 1
            _STATS['seconds'] += time.perf_counter() - _t0
            if _STATS['calls'] % 50 == 0:
                print(f"[SEGPROF] calls={_STATS['calls']} fast={_STATS['fast']} "
                      f"slow={_STATS['slow']} secs={_STATS['seconds']:.2f} "
                      f"pts_scanned={_STATS['points']}", flush=True)

        return segments
