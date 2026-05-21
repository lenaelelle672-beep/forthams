# forthAMS Design System — Stitch Integration Configuration

## Project Identity
- **Project**: forthAMS (Asset Management System)
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS 4 + CSS Variables
- **Component Libraries**: Radix UI (primitives) + MUI 7 (complex widgets)
- **Charts**: Recharts + @xyflow/react
- **Icons**: Lucide React
- **Layout**: react-router v7, sidebar-based SPA

## Design Tokens (Light Mode)

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| --background | #ffffff | Page background |
| --foreground | #0f172a | Primary text |
| --primary | #3b82f6 | Brand blue, CTAs, links |
| --primary-foreground | #ffffff | Text on primary |
| --secondary | #f1f5f9 | Secondary backgrounds |
| --muted | #f1f5f9 | Muted backgrounds |
| --muted-foreground | #64748b | Secondary text |
| --destructive | #ef4444 | Error, delete actions |
| --border | #e5e7eb | Borders, dividers |
| --card | #ffffff | Card backgrounds |
| --sidebar | #0a1628 | Sidebar background (dark navy) |
| --sidebar-foreground | #cbd5e1 | Sidebar text |
| --sidebar-primary | #3b82f6 | Sidebar active/accent |
| --sidebar-accent | #1e3a5f | Sidebar hover state |
| --ring | #3b82f6 | Focus rings |

### Charts Palette
| Token | Value |
|-------|-------|
| --chart-1 | #3b82f6 (blue) |
| --chart-2 | #06b6d4 (cyan) |
| --chart-3 | #8b5cf6 (violet) |
| --chart-4 | #f59e0b (amber) |
| --chart-5 | #10b981 (emerald) |

### Typography
| Property | Value |
|----------|-------|
| Font family | Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif |
| Base size | 16px |
| Heading weight | 500 |
| Body weight | 400 |

### Spacing & Radius
| Token | Value |
|-------|-------|
| --radius | 0.625rem (10px) |
| --radius-sm | 6px |
| --radius-md | 8px |
| --radius-lg | 10px |
| --radius-xl | 14px |
| Card shadow | 0 1px 2px rgba(15,23,42,0.04), 0 10px 28px rgba(15,23,42,0.06) |

## Component Mapping (Stitch HTML → forthAMS Components)

### Layout
| Stitch Output | forthAMS Component |
|---------------|-------------------|
| Sidebar navigation | `<Sidebar>` from layout, use `--sidebar-*` tokens |
| Top header/app bar | `<AppHeader>` with breadcrumb |
| Content area | `<main>` with page-container class |
| Cards | Use `--enterprise-card-*` variables |

### Radix UI Components (import from @radix-ui/*)
| Stitch Pattern | Use This |
|----------------|----------|
| Dialog / Modal | `@radix-ui/react-dialog` |
| Dropdown | `@radix-ui/react-dropdown-menu` |
| Tabs | `@radix-ui/react-tabs` |
| Select | `@radix-ui/react-select` |
| Popover | `@radix-ui/react-popover` |
| Tooltip | `@radix-ui/react-tooltip` |
| Accordion | `@radix-ui/react-accordion` |
| Checkbox | `@radix-ui/react-checkbox` |
| Switch | `@radix-ui/react-switch` |
| ScrollArea | `@radix-ui/react-scroll-area` |
| Slider | `@radix-ui/react-slider` |
| Toast | `sonner` (already installed) |

### MUI Components (import from @mui/material)
| Stitch Pattern | Use This |
|----------------|----------|
| Data Table | `<DataGrid>` from @mui/x-data-grid if available, else custom with Radix |
| Date Picker | `<DatePicker>` from @mui/x-date-pickers if available |
| Complex form | React Hook Form + Radix primitives |

### Utility Libraries
| Purpose | Library |
|---------|---------|
| Class names | `clsx` + `tailwind-merge` via `cn()` |
| Variants | `class-variance-authority` (CVA) |
| Animations | `motion` (framer-motion) |
| Icons | `lucide-react` |

## Stitch Generation Rules

### Prompt Template
When generating screens for forthAMS, always include:
```
Enterprise asset management system (AMS) with dark navy sidebar (#0a1628), 
white content area, blue (#3b82f6) accent color. Clean, professional, 
data-dense layout. Use Inter font family. Cards with subtle shadows. 
Table-heavy with clean borders. Mobile-responsive with collapsible sidebar.
```

### Screen Types to Generate
1. Dashboard — KPI cards + charts + recent activity
2. Asset List — data table with filters, search, bulk actions
3. Asset Detail — header info + tabs (details, documents, maintenance, audit log)
4. Work Order Management — kanban + list view toggle
5. Inventory — grid/list with barcode scan support
6. Reports — charts + export options
7. Settings — form-based with sections

### Code Generation Rules
1. Always use TypeScript (.tsx)
2. Use `cn()` utility from `@/imports` for class merging
3. Import components from their canonical paths
4. Use CSS variables (--primary, --background, etc.) not hardcoded colors
5. Use Radix primitives for interactive elements, NOT raw HTML
6. Follow existing file structure: `src/pages/{FeatureName}/`
7. Each page gets its own directory with index.tsx + components/
8. Use React Hook Form for forms
9. Use `sonner` toast for notifications
10. Use `lucide-react` for icons (never use emoji or text icons)

## File Structure Convention
```
src/
├── pages/{FeatureName}/
│   ├── index.tsx              # Main page component
│   ├── {FeatureName}.module.css  # Page styles (if needed)
│   └── components/            # Page-specific components
│       └── {SubComponent}/
│           └── index.tsx
├── components/                # Shared components
│   └── {ComponentName}/
│       └── index.tsx
├── hooks/                     # Custom hooks
├── api/                       # API calls
├── stores/                    # State management
└── types/                     # TypeScript types
```
