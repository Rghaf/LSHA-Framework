import { useEffect, useState } from "react";

// Removed curly braces around 'url' for cleaner usage
function useFetch(url) {
  const [fetchedData, setFetchedData] = useState(null);

  useEffect(() => {
    // Optional: Reset data when URL changes so user doesn't see old data
    setFetchedData(null);

    fetch(url)
      .then((response) => response.json())
      .then((data) => setFetchedData(data))
      .catch((error) => console.error("Error fetching data:", error));
  }, [url]); // <--- Fixed: Array is inside the parenthesis

  return fetchedData;
}

export default useFetch;
