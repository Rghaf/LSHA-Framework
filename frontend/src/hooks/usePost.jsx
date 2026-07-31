import { useState } from "react";

export function usePost(url) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  async function postData(data) {
    setIsLoading(true);
    setError(null);
    try {
      const isFormData =
        typeof FormData !== "undefined" && data instanceof FormData;
      const res = await fetch(url, {
        method: "POST",
        headers: isFormData
          ? undefined
          : { "Content-Type": "application/json" },
        body: isFormData ? data : JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      setResponse(json);

      return json;
    } catch (err) {
      setError(err);

      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  return { postData, isLoading, error, response };
}
