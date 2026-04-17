declare module 'react-simple-maps' {
  import type { ComponentType, ReactNode } from 'react'

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: { scale?: number; center?: [number, number]; rotate?: [number, number, number] }
    width?: number
    height?: number
    children?: ReactNode
  }
  export const ComposableMap: ComponentType<ComposableMapProps>

  interface GeographiesProps {
    geography: string | object
    children: (data: { geographies: Array<{ rsmKey: string; id: string; properties: Record<string, string> }> }) => ReactNode
  }
  export const Geographies: ComponentType<GeographiesProps>

  interface GeographyProps {
    geography: { rsmKey: string; id: string; properties: Record<string, string> }
    onClick?: (event: React.MouseEvent) => void
    onMouseEnter?: (event: React.MouseEvent) => void
    onMouseLeave?: (event: React.MouseEvent) => void
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
    tabIndex?: number
    role?: string
    'aria-label'?: string
    className?: string
  }
  export const Geography: ComponentType<GeographyProps>

  interface AnnotationProps {
    subject: [number, number]
    dx?: number
    dy?: number
    connectorProps?: React.SVGProps<SVGPathElement>
    children?: ReactNode
  }
  export const Annotation: ComponentType<AnnotationProps>
}
