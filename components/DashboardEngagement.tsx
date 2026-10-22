"use client";

import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  LocateFixed,
  RefreshCw,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Weather = {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
};

const leadershipQuotes = [
  { quote: "Consult them in affairs. Then, when you have decided, put your trust in Allah.", source: "Qur’an 3:159" },
  { quote: "Allah commands you to return trusts to their rightful owners and, when you judge between people, to judge with fairness.", source: "Qur’an 4:58" },
  { quote: "Cooperate with one another in goodness and righteousness.", source: "Qur’an 5:2" },
  { quote: "Indeed, Allah loves those who act justly.", source: "Qur’an 5:42" },
  { quote: "Allah does not change the condition of a people until they change what is within themselves.", source: "Qur’an 13:11" },
  { quote: "Speak kindly to people.", source: "Qur’an 2:83" },
  { quote: "My success comes only through Allah.", source: "Qur’an 11:88" },
];

function weatherDetails(code: number) {
  if (code === 0) return { label: "Clear sky", Icon: Sun };
  if ([1, 2, 3, 45, 48].includes(code)) return { label: code >= 45 ? "Foggy" : "Partly cloudy", Icon: Cloud };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Current conditions", Icon: Cloud };
}

export default function DashboardEngagement({ audience }: { audience: "admin" | "employee" }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(audience === "admin" ? 0 : 1);

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
            current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
            timezone: "auto",
          });
          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
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
      () => {
        setWeatherError("Allow location access to see your local weather.");
        setWeatherLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 2 * 60 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    loadWeather();
    setQuoteIndex(Math.floor(Date.now() / (2 * 60 * 60 * 1000)) % leadershipQuotes.length);
    const weatherTimer = window.setInterval(loadWeather, 2 * 60 * 60 * 1000);
    const quoteTimer = window.setInterval(
      () => setQuoteIndex((current) => (current + 1) % leadershipQuotes.length),
      2 * 60 * 60 * 1000,
    );
    return () => {
      window.clearInterval(weatherTimer);
      window.clearInterval(quoteTimer);
    };
  }, [loadWeather]);

  const condition = weather ? weatherDetails(weather.weatherCode) : null;
  const WeatherIcon = condition?.Icon || Sun;
  const quote = leadershipQuotes[quoteIndex];

  return (
    <section className="dashboard-engagement" aria-label="Weather and inspiration">
      <article className="engagement-weather">
        <div className="engagement-icon"><WeatherIcon size={25} /></div>
        <div className="engagement-copy">
          <span>Live local weather</span>
          {weatherLoading ? (
            <strong>Getting conditions…</strong>
          ) : weather ? (
            <>
              <strong>{Math.round(weather.temperature)}°C · {condition?.label}</strong>
              <small>Feels like {Math.round(weather.apparentTemperature)}° · Wind {Math.round(weather.windSpeed)} km/h</small>
            </>
          ) : (
            <strong>{weatherError}</strong>
          )}
        </div>
        <button type="button" className="engagement-refresh" onClick={loadWeather} disabled={weatherLoading} aria-label="Refresh local weather">
          <LocateFixed size={17} />
        </button>
      </article>

      <article className="engagement-quote">
        <div className="engagement-copy">
          <span>Leadership quote</span>
          <strong>{quote.quote}</strong>
          <small>{quote.source}</small>
        </div>
        <button type="button" className="engagement-refresh" onClick={() => setQuoteIndex((current) => (current + 1) % leadershipQuotes.length)} aria-label="Show another leadership quote">
          <RefreshCw size={17} />
        </button>
      </article>
    </section>
  );
}
