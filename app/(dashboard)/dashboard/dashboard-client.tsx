"use client";

import { Card } from "@/components/ui/card";

import {
  BarChart3,
  Users,
  IndianRupee,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Statistics } from "@/components/hubspot/Statistics";

export default function DashboardClient({ stats }: { stats: any }) {
  const {
    totalRevenue,
    activeContacts,
    pipelineValue,
    predictedRevenue,
    pendingTasks,
    recentActivity,
    revenueChartData,
    insight,
  } = stats;

  const chartData =
    revenueChartData.length > 0
      ? revenueChartData
      : [
          { name: "Jan", value: 0 },
          { name: "Feb", value: 0 },
          { name: "Mar", value: 0 },
          { name: "Apr", value: 0 },
          { name: "May", value: 0 },
          { name: "Jun", value: 0 },
        ];

  const cards = [
    {
      title: "Total Revenue",
      value: `₹${Number(totalRevenue).toLocaleString("en-IN")}`,
      change: "+12.5",
      icon: IndianRupee,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Active Contacts",
      value: Number(activeContacts).toLocaleString("en-IN"),
      change: "+4.3",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Sales Pipeline",
      value: `₹${Number(pipelineValue).toLocaleString("en-IN")}`,
      change: "+8.2",
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      title: "Predicted Revenue",
      value: `₹${Number(predictedRevenue).toLocaleString("en-IN")}`,
      change: "+10.1",
      icon: BarChart3,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      title: "Pending Tasks",
      value: Number(pendingTasks).toLocaleString("en-IN"),
      change: "-2",
      icon: Calendar,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your business performance.
        </p>
      </div>

      {/* AI INSIGHT STRIP */}
      <div className="rounded-xl border border-border/50 bg-primary/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">AI Insight</p>
          <p className="text-sm text-muted-foreground">
            {insight && insight.change !== 0 ? (
              <>
                Revenue likely to {insight.change > 0 ? "increase" : "decrease"} by{" "}
                {Math.abs(insight.change)}% next month 🚀
              </>
            ) : (
              "Add more closed deals to generate AI insights."
            )}
          </p>
        </div>
        <TrendingUp className="h-5 w-5 text-primary" />
      </div>

      {/* STATS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <Statistics
                  label={card.title}
                  value={card.value}
                  trend={{
                    value: parseFloat(card.change),
                    direction: card.change.includes("+")
                      ? "increase"
                      : "decrease",
                  }}
                />
                <div className={`p-2 rounded-full ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-4 md:grid-cols-8">
        {/* CHART */}
        <Card className="col-span-5 p-6 glass">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Revenue Overview</h3>
              <p className="text-sm text-muted-foreground">
                Monthly revenue from closed deals
              </p>
            </div>
            <span className="text-sm font-medium text-green-500">+12.5%</span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop
                      offset="100%"
                      stopColor="#f97316"
                      stopOpacity={0.02}
                    />
                  </linearGradient>

                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(255,255,255,0.05)"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                  tickFormatter={(v) => `₹${v}`}
                />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="rounded-lg border border-border/50 bg-background/80 backdrop-blur-xl px-3 py-2 shadow-lg">
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-sm font-semibold text-primary">
                            ₹{payload[0].value}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  fill="url(#colorValue)"
                  filter="url(#glow)"
                  activeDot={{
                    r: 6,
                    stroke: "#f97316",
                    strokeWidth: 2,
                    fill: "#fff",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ACTIVITY */}
        <Card className="col-span-3 p-6 glass">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <p className="text-sm text-muted-foreground">
              Latest actions across your workspace
            </p>
          </div>

          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-4 hover:bg-muted/40 p-2 rounded-lg transition"
                >
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      item.type === "deal" ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {item.type === "deal"
                        ? "New Deal Created"
                        : "New Task Added"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No activity yet — start by creating a deal 🚀
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
