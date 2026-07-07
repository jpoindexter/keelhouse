import { motion } from 'motion/react'
import { useCallback, useState } from 'react'
import type { PanelProps } from './types'

const COLLAPSED_WIDTH = 48
const EXPANDED_WIDTH = 288
const TRANSITION_MS = 180

// I5: panel collapse — width animates, content fades under it
export function Panel({ collapsed, onToggle, children }: PanelProps) {
  const [hovering, setHovering] = useState(false)
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  const handleToggle = useCallback(() => {
    onToggle(!collapsed)
  }, [collapsed, onToggle])

  return (
    <motion.aside
      className="panel"
      animate={{ width }}
      transition={{ duration: TRANSITION_MS / 1000 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        onClick={handleToggle}
        className={hovering ? 'toggle toggle--visible' : 'toggle'}
      >
        {collapsed ? '»' : '«'}
      </button>
      {!collapsed && <div className="panel__content">{children}</div>}
    </motion.aside>
  )
}
