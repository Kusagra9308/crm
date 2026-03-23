"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  if (!stats) return <div className="p-8">Loading dashboard...</div>;

  const {
    totalRevenue,
    activeContacts,
    pipelineValue,
    predictedRevenue,
    pendingTasks,
    recentActivity,
    revenueChartData,
    insight,
    revenueChange = "0%",
    contactsChange = "0%",
    pipelineChange = "0%",
    tasksChange = "0%",
    predictedChange = "0%",
    weightedRevenue = 0,
    pipelineHealth = 0,
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

  // Helper for trend colors and sanitizing NaN
  const getTrendData = (changeString: string = "0%") => {
    if (!changeString || changeString.includes("NaN")) return { color: "text-muted-foreground", value: "--", direction: "neutral" };
    const isPositive = changeString.startsWith("+");
    const isNegative = changeString.startsWith("-");
    return {
      color: isPositive ? "text-emerald-500" : isNegative ? "text-rose-500" : "text-muted-foreground",
      value: changeString,
      direction: isPositive ? "up" : isNegative ? "down" : "neutral"
    };
  };

  const heroCard = {
    title: "Total Revenue",
    value: `₹${Number(totalRevenue).toLocaleString("en-IN")}`,
    trend: getTrendData(revenueChange),
    icon: IndianRupee,
  };

  const secondaryCards = [
    {
      title: "Active Contacts",
      value: Number(activeContacts).toLocaleString("en-IN"),
      trend: getTrendData(contactsChange),
      icon: Users,
    },
    {
      title: "Sales Pipeline",
      value: `₹${Number(pipelineValue).toLocaleString("en-IN")}`,
      trend: getTrendData(pipelineChange),
      icon: TrendingUp,
    },
    {
      title: "Weighted Forecast",
      value: `₹${Number(weightedRevenue).toLocaleString("en-IN")}`,
      trend: { value: "AI Target", color: "text-blue-500" },
      icon: BarChart3,
    },
    {
      title: "Pipeline Health",
      value: `${Math.round(pipelineHealth)}%`,
      trend: { value: "Avg. Win Prob", color: "text-muted-foreground" },
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight">Overview</h2>
          <p className="text-muted-foreground text-lg">
            A real-time snapshot of your organization's performance.
          </p>
        </div>
        <div className="text-right hidden md:block">
           <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Global Status</p>
           <div className="flex items-center gap-2 text-emerald-500 font-bold">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Data Active
           </div>
        </div>
      </div>

      {/* HERO SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden group"
      >
        <Card className="p-8 border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl relative z-10">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                 <p className="text-slate-400 font-medium tracking-wide uppercase text-xs">{heroCard.title}</p>
                 <h1 className="text-5xl md:text-6xl font-black">{heroCard.value}</h1>
                 <div className="flex items-center gap-2 mt-2">
                    <span className={`text-sm font-bold flex items-center gap-1 ${heroCard.trend.color}`}>
                       {heroCard.trend.value} vs last month
                    </span>
                    <span className="text-slate-500 text-sm">• Monthly Performance</span>
                 </div>
              </div>
              <div className="h-20 w-20 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center">
                 <heroCard.icon className="h-10 w-10 text-primary" />
              </div>
           </div>

           {/* Decorative background flare */}
           <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
           <div className="absolute -bottom-24 -left-24 h-64 w-64 bg-orange-600/10 rounded-full blur-[80px] pointer-events-none" />
        </Card>
      </motion.div>

      {/* AI INSIGHT STRIP */}
      <div className="rounded-2xl border border-border/40 bg-muted/30 p-4 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
             <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">AI REVENUE CO-PILOT</p>
            <p className="text-sm text-muted-foreground">
              {insight && insight.change !== 0 ? (
                <>
                  Revenue likely to {insight.change > 0 ? "increase" : "decrease"} by{" "}
                  <span className="font-bold text-foreground">{Math.abs(insight.change)}%</span> next month 🚀
                </>
              ) : (
                "Add more closed deals to generate AI insights."
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="hidden sm:flex rounded-lg border-primary/20 hover:bg-primary/5">
           View Predictions
        </Button>
      </div>

      {/* SECONDARY STATS GRID */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {secondaryCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className="p-6 h-full hover:shadow-xl transition-all border-border/50 bg-card/50 hover:bg-card">
              <div className="flex flex-col h-full justify-between gap-4">
                <div className="flex items-center justify-between">
                   <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <card.icon className="h-5 w-5 text-muted-foreground" />
                   </div>
                   <span className={`text-xs font-bold px-2 py-1 rounded-md bg-muted ${card.trend.color}`}>
                      {card.trend.value}
                   </span>
                </div>
                <div className="space-y-1">
                   <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                   <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* CHART CONTAINER */}
        <Card className="md:col-span-8 p-8 border-border/50 bg-card/50 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Revenue Overview</h3>
              <p className="text-sm text-muted-foreground">
                Monthly revenue from closed deals
              </p>
            </div>
            <span className={`text-sm font-medium ${revenueChange.includes('+') ? 'text-green-500' : 'text-red-500'}`}>
              {revenueChange}
            </span>
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
