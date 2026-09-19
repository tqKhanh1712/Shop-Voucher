"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const currentTheme = theme === 'system' ? resolvedTheme : theme;

  return (
    <button
      onClick={() => setTheme(currentTheme === "light" ? "dark" : "light")}
      className="inline-flex relative items-center justify-center rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring text-slate-700 dark:text-slate-300"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
