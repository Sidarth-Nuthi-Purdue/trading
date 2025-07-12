'use client';

import React from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconChartCandle,
  IconDashboard,
  IconHistory,
  IconSettings,
  IconWallet,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";

export function NavigationDock() {
  const pathname = usePathname();

  const links = [
    {
      title: "Dashboard",
      icon: (
        <IconDashboard className="h-full w-full" />
      ),
      href: "/dashboard",
    },
    {
      title: "Trading",
      icon: (
        <IconChartCandle className="h-full w-full" />
      ),
      href: "/exchange",
    },
    {
      title: "History",
      icon: (
        <IconHistory className="h-full w-full" />
      ),
      href: "/dashboard/history",
    },
    {
      title: "Settings",
      icon: (
        <IconSettings className="h-full w-full" />
      ),
      href: "/dashboard/settings",
    },
  ];

  // Add active state to the current page
  const navigationItems = links.map(link => ({
    ...link,
    isActive: pathname === link.href || pathname.startsWith(`${link.href}/`),
  }));

  return (
    <FloatingDock
      items={navigationItems}
    />
  );
} 