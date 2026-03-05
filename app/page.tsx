"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GymEntry = { id: number; ts: string; count: number; source: string };

export default function Home() {
  const [data, setData] = useState<GymEntry[]>([]);

  useEffect(() => {
    // Load initial data
    supabase
      .from("gym_data_4Nick")
      .select("*")
      .order("ts", { ascending: true })
      .then(({ data }) => { if (data) setData(data); });

    // Live updates
    const channel = supabase
      .channel("gym-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gym_data_4Nick" },
        (payload) => setData((prev) => [...prev.slice(-99), payload.new as GymEntry])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.ts).toLocaleTimeString(),
  }));

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">🏋️ Gym Occupancy Live</h1>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </main>
  );
}