"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GymEntry = { id: number; ts: string; count: number; source: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Home() {
  const [data, setData] = useState<GymEntry[]>([]);

  useEffect(() => {
    supabase
      .from("gym_data_4Nick")
      .select("*")
      .order("ts", { ascending: true })
      .then(({ data }) => { if (data) setData(data); });

    const channel = supabase
      .channel("gym-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gym_data_4Nick" },
        (payload) => setData((prev) => [...prev, payload.new as GymEntry])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Live chart data
  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.ts).toLocaleString(),
  }));

  // Peak hours — average count by hour of day (Taiwan time UTC+8), 8:00–22:00 only
  const hourlyMap: Record<number, number[]> = {};
  data.forEach((d) => {
    const hour = (new Date(d.ts).getUTCHours() + 8) % 24;
    if (!hourlyMap[hour]) hourlyMap[hour] = [];
    hourlyMap[hour].push(d.count);
  });
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    avg: hourlyMap[h] ? Math.round(hourlyMap[h].reduce((a, b) => a + b, 0) / hourlyMap[h].length) : 0,
  })).filter((h) => parseInt(h.hour) >= 8 && parseInt(h.hour) <= 22);

  // Best time to go — 3 quietest hours (excluding last hour before close)
  const now = new Date();
  const taiwanDay = new Date(now.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
  const day = taiwanDay;
  const closingHour = day === 0 ? 17 : 21; // Sun closes 18:00, others 22:00
  const openingHour = day >= 1 && day <= 5 ? 8 : 9; // Mon-Fri open 8:00, Sat/Sun 9:00

  const bestTimes = [...hourlyData]
    .filter((h) => {
      const hour = parseInt(h.hour);
      return h.avg > 0 && hour >= openingHour && hour < closingHour;
    })
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  // Day of week trends
  const dayMap: Record<number, number[]> = {};
  data.forEach((d) => {
    const entryDay = new Date(d.ts).getUTCDay();
    if (!dayMap[entryDay]) dayMap[entryDay] = [];
    dayMap[entryDay].push(d.count);
  });
  const dayData = DAYS.map((name, i) => ({
    day: name.slice(0, 3),
    avg: dayMap[i] ? Math.round(dayMap[i].reduce((a, b) => a + b, 0) / dayMap[i].length) : 0,
  }));

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">🏋️ NTU Gym Dashboard</h1>

      {/* Live chart */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">Live Occupancy</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Peak hours */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">Peak Hours (avg occupancy by hour)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avg" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Best time to go */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">🟢 Best Times to Go (least busy)</h2>
        <div className="flex gap-4">
          {bestTimes.map((t) => (
            <div key={t.hour} className="bg-green-100 rounded-xl p-4 text-center w-32">
              <div className="text-xl font-bold">{t.hour}</div>
              <div className="text-sm text-gray-500">avg {t.avg} people</div>
            </div>
          ))}
        </div>
      </section>

      {/* Day of week */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">Day of Week Trends</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avg" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </main>
  );
}