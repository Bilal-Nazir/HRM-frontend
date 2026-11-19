"use client";

import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  LocateFixed,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DashboardQuote from "@/components/DashboardQuote";

type Weather = {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
};

function weatherDetails(code: number) {
  if (code === 0) return { label: "Clear sky", Icon: Sun };
  if ([1, 2, 3, 45, 48].includes(code))
    return { label: code >= 45 ? "Foggy" : "Partly cloudy", Icon: Cloud };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: "Rain", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Snow", Icon: CloudSnow };
  if ([95, 96, 99].includes(code))
    return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Current conditions", Icon: Cloud };
}

export default function DashboardEngagement({
  audience,
  showQuote = true,
  compact = false,
}: {
  audience: "admin" | "employee";
  showQuote?: boolean;
  compact?: boolean;
}) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);

  const loadWeather = useCallback(() => {
    setWeatherLoading(true);
    setWeatherError("");
    if (!navigator.geolocation) {
      setWeatherError("Location is not supported by this browser.");
      setWeatherLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
            current:
              "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
            timezone: "auto",
          });
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?${params}`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Weather service unavailable");
          const data = await response.json();
          setWeather({
            temperature: data.current.temperature_2m,
            apparentTemperature: data.current.apparent_temperature,
            weatherCode: data.current.weather_code,
            windSpeed: data.current.wind_speed_10m,
          });
        } catch {
          setWeatherError("Live weather is temporarily unavailable.");
        } finally {
          setWeatherLoading(false);
        }
      },
      (error) => {
        setWeatherError(
          error.code === 1
            ? "Location access is blocked. Allow this site and your browser to use location."
            : error.code === 3
              ? "Finding your location timed out. Check Location Services and retry."
              : "Your device could not determine its location. Check Location Services and retry.",
        );
        setWeatherLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 2 * 60 * 60 * 1000,
      },
    );
  }, []);

  useEffect(() => {
    loadWeather();
    const weatherTimer = window.setInterval(loadWeather, 2 * 60 * 60 * 1000);
    return () => {
      window.clearInterval(weatherTimer);
    };
  }, [loadWeather]);

  const condition = weather ? weatherDetails(weather.weatherCode) : null;
  const WeatherIcon = condition?.Icon || Sun;

  if (compact)
    return (
      <div className="welcome-weather">
        <button
          type="button"
          onClick={loadWeather}
          disabled={weatherLoading}
          title={
            weather
              ? `Feels like ${Math.round(weather.apparentTemperature)}° · Wind ${Math.round(weather.windSpeed)} km/h. Click to refresh.`
              : weatherError || "Getting local weather"
          }
          aria-label={
            weather
              ? `Local weather: ${Math.round(weather.temperature)}°C, ${condition?.label}. Refresh weather`
              : weatherError || "Loading local weather"
          }
        >
          {weatherLoading
            ? "Loading weather…"
            : weather
              ? `${Math.round(weather.temperature)}°C · ${condition?.label}`
              : "Weather unavailable"}
        </button>
      </div>
    );

  return (
    <section
      className={`dashboard-engagement ${showQuote ? "" : "weather-only"}`}
      aria-label={showQuote ? "Weather and inspiration" : "Local weather"}
    >
      <article className="engagement-weather">
        <div className="engagement-icon">
          <WeatherIcon size={25} />
        </div>
        <div className="engagement-copy">
          <span>Live local weather</span>
          {weatherLoading ? (
            <strong>Getting conditions…</strong>
          ) : weather ? (
            <>
              <strong>
                {Math.round(weather.temperature)}°C · {condition?.label}
              </strong>
              <small>
                Feels like {Math.round(weather.apparentTemperature)}° · Wind{" "}
                {Math.round(weather.windSpeed)} km/h
              </small>
            </>
          ) : (
            <strong>{weatherError}</strong>
          )}
        </div>
        <button
          type="button"
          className="engagement-refresh"
          onClick={loadWeather}
          disabled={weatherLoading}
          aria-label="Refresh local weather"
        >
          <LocateFixed size={17} />
        </button>
      </article>

      {showQuote && <DashboardQuote audience={audience} />}
    </section>
  );
}
