import { useEffect, useState } from "react"

const HYSTERESIS = 6
const TOP_SLACK = 64

export function useScrollCompact(): boolean {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const scroller = document.getElementById("app-scroll")
    const posY = () => Math.max(window.scrollY, scroller?.scrollTop ?? 0)

    let lastY = posY()
    let ticking = false

    const measure = () => {
      ticking = false
      const y = posY()
      const dy = y - lastY
      if (Math.abs(dy) < HYSTERESIS) return
      lastY = y
      setCompact(y > TOP_SLACK && dy > 0)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(measure)
      }
    }
    const onRouteChange = () => {
      lastY = 0
      setCompact(false)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    scroller?.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("hashchange", onRouteChange)
    return () => {
      window.removeEventListener("scroll", onScroll)
      scroller?.removeEventListener("scroll", onScroll)
      window.removeEventListener("hashchange", onRouteChange)
    }
  }, [])

  return compact
}
