import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { DEFAULT_CITY_OPTIONS, mergeCityOptions } from "../data/cityOptions";

export function useCityOptions(additionalCities: string[] = []) {
  const [liveCities, setLiveCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  useEffect(() => {
    let active = true;

    apiClient
      .get("/api/search/cities")
      .then((response) => {
        const data = response.data?.data;
        if (active && response.data?.success && Array.isArray(data)) {
          setLiveCities(data.filter((city): city is string => typeof city === "string"));
        }
      })
      .catch(() => {
        // The bundled list keeps the operator forms usable if search is unavailable.
      })
      .finally(() => {
        if (active) setLoadingCities(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const additionalKey = additionalCities.join("\u0000");
  const cities = useMemo(
    () => mergeCityOptions(liveCities, additionalCities, DEFAULT_CITY_OPTIONS).sort((a, b) => a.localeCompare(b)),
    // additionalKey makes callers safe even when they construct the array inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveCities, additionalKey],
  );

  return { cities, loadingCities };
}
