/// <reference types="vite/client" />

declare module "@xyflow/react/dist/style.css";

// ---------------------------------------------------------------------------
// 第三方模块类型声明（缺少 @types 包的模块）
// ---------------------------------------------------------------------------

declare module "antd" {
  const _default: Record<string, unknown>;
  export default _default;
  export const Table: any;
  export const Button: any;
  export const Modal: any;
  export const Select: any;
  export const Input: any;
  export const Form: any;
  export const DatePicker: any;
  export const Tag: any;
  export const Badge: any;
  export const Tooltip: any;
  export const Space: any;
  export const Card: any;
  export const Tabs: any;
  export const message: any;
  export const notification: any;
  export const Popconfirm: any;
  export const Dropdown: any;
  export const Menu: any;
  export const Checkbox: any;
  export const Radio: any;
  export const Switch: any;
  export const Spin: any;
  export const Progress: any;
  export const Statistic: any;
  export const Row: any;
  export const Col: any;
  export const Divider: any;
  export const Tree: any;
  export const Cascader: any;
  export const Typography: any;
  export const Alert: any;
  export const Empty: any;
  export const Steps: any;
  export const Upload: any;
  export const ConfigProvider: any;
  export type { TableProps, SelectProps, ModalProps, FormProps, InputProps, ButtonProps } from "antd";
}

declare module "antd/es/table" {
  export const Table: any;
  export type ColumnsType<T = any> = any;
  export type TablePaginationConfig = any;
}

declare module "antd/es/table/interface" {
  export type ColumnType<T = any> = Record<string, any>;
  export type TablePaginationConfig = Record<string, any>;
  export type TableRowSelection<T = any> = Record<string, any>;
}

declare module "antd/es/select" {
  export const Select: any;
}

declare module "antd/es/cascader" {
  export const Cascader: any;
}

declare module "@ant-design/icons" {
  export const PlusOutlined: any;
  export const SearchOutlined: any;
  export const EditOutlined: any;
  export const DeleteOutlined: any;
  export const EyeOutlined: any;
  export const ExportOutlined: any;
  export const ImportOutlined: any;
  export const FilterOutlined: any;
  export const ReloadOutlined: any;
  export const DownloadOutlined: any;
  export const UploadOutlined: any;
  export const CheckOutlined: any;
  export const CloseOutlined: any;
  export const WarningOutlined: any;
  export const ExclamationCircleOutlined: any;
  export const QuestionCircleOutlined: any;
  export const InfoCircleOutlined: any;
  export const SettingOutlined: any;
  export const MoreOutlined: any;
  export const DownOutlined: any;
  export const UpOutlined: any;
  export const LeftOutlined: any;
  export const RightOutlined: any;
  export const FileExcelOutlined: any;
  export const InboxOutlined: any;
  export const ScanOutlined: any;
  export const PrinterOutlined: any;
  export const CameraOutlined: any;
  export const BarChartOutlined: any;
  export const PieChartOutlined: any;
  export const LineChartOutlined: any;
  export const DashboardOutlined: any;
  export const HomeOutlined: any;
  export const UserOutlined: any;
  export const TeamOutlined: any;
  export const SafetyOutlined: any;
  export const AppstoreOutlined: any;
  export const ShoppingCartOutlined: any;
  export const ToolOutlined: any;
  export const AuditOutlined: any;
  export const ClockCircleOutlined: any;
  export const TagOutlined: any;
  export const FileTextOutlined: any;
  export const RetweetOutlined: any;
  export const SwapOutlined: any;
  export const ThunderboltOutlined: any;
  export const ClearOutlined: any;
  export const SaveOutlined: any;
  export const UndoOutlined: any;
  export const RedoOutlined: any;
  export const CopyOutlined: any;
  export const LinkOutlined: any;
  export const DisconnectOutlined: any;
  export const BranchesOutlined: any;
  export const ApartmentOutlined: any;
  export const SolutionOutlined: any;
  export const CarOutlined: any;
  export const EnvironmentOutlined: any;
  export const PhoneOutlined: any;
  export const MailOutlined: any;
  export const CalendarOutlined: any;
  export const PercentageOutlined: any;
  export const DollarOutlined: any;
  export const NumberOutlined: any;
  export const CodeOutlined: any;
  export const DatabaseOutlined: any;
  export const CloudOutlined: any;
  export const LockOutlined: any;
  export const UnlockOutlined: any;
  export const KeyOutlined: any;
  export const PoweroffOutlined: any;
  export const LogoutOutlined: any;
  export const LoginOutlined: any;
  export const MenuFoldOutlined: any;
  export const MenuUnfoldOutlined: any;
  export const FullscreenOutlined: any;
  export const FullscreenExitOutlined: any;
  export const ExpandOutlined: any;
  export const CompressOutlined: any;
  export const ArrowUpOutlined: any;
  export const ArrowDownOutlined: any;
  export const ArrowLeftOutlined: any;
  export const ArrowRightOutlined: any;
  export const SortAscendingOutlined: any;
  export const SortDescendingOutlined: any;
  export const ZoomInOutlined: any;
  export const ZoomOutOutlined: any;
  export const BugOutlined: any;
  export const BulbOutlined: any;
  export const FireOutlined: any;
  export const StarOutlined: any;
  export const HeartOutlined: any;
  export const LikeOutlined: any;
  export const DislikeOutlined: any;
  export const SmileOutlined: any;
  export const FrownOutlined: any;
  export const MehOutlined: any;
  export const LoadingOutlined: any;
  export const CheckCircleOutlined: any;
  export const CloseCircleOutlined: any;
  export const InfoCircleFilled: any;
  export const WarningFilled: any;
  export const PlusCircleOutlined: any;
  export const MinusCircleOutlined: any;
  export const PlayCircleOutlined: any;
  export const PauseCircleOutlined: any;
  export const SyncOutlined: any;
  export const CloudSyncOutlined: any;
  export const HistoryOutlined: any;
  export const ScheduleOutlined: any;
  export const FieldTimeOutlined: any;
  export const FundOutlined: any;
  export const StockOutlined: any;
  export const RiseOutlined: any;
  export const FallOutlined: any;
  export const DeploymentUnitOutlined: any;
  export const ClusterOutlined: any;
  export const GatewayOutlined: any;
  export const RobotOutlined: any;
  export const ExperimentOutlined: any;
  export const PartitionOutlined: any;
  export const SplitCellsOutlined: any;
  export const BlockOutlined: any;
  export const AimOutlined: any;
  export const CompassOutlined: any;
  export const CompassFilled: any;
  export const ProfileOutlined: any;
  export const ContainerOutlined: any;
  export const BuildOutlined: any;
  export const ReconciliationOutlined: any;
  export const AccountBookOutlined: any;
  export const MoneyCollectOutlined: any;
  export const PayCircleOutlined: any;
  export const PropertySafetyOutlined: any;
  export const TrophyOutlined: any;
  export const FlagOutlined: any;
  export const BellOutlined: any;
  export const SoundOutlined: any;
  export const AudioOutlined: any;
  export const VideoCameraOutlined: any;
  export const CameraFilled: any;
  export const PictureOutlined: any;
  export const FileOutlined: any;
  export const FilePdfOutlined: any;
  export const FileWordOutlined: any;
  export const FilePptOutlined: any;
  export const FileImageOutlined: any;
  export const FileZipOutlined: any;
  export const FileAddOutlined: any;
  export const FileDoneOutlined: any;
  export const FileSearchOutlined: any;
  export const FileProtectOutlined: any;
  export const FolderOutlined: any;
  export const FolderOpenOutlined: any;
  export const FolderAddOutlined: any;
  export const DiffOutlined: any;
  export const GroupOutlined: any;
  export const ReadOutlined: any;
  export const BookOutlined: any;
  export const ContactsOutlined: any;
  export const IdcardOutlined: any;
  export const ManOutlined: any;
  export const WomanOutlined: any;
  export const CrownOutlined: any;
  export const GlobalOutlined: any;
  export const ShopOutlined: any;
  export const ShoppingOutlined: any;
  export const WalletOutlined: any;
  export const TransactionOutlined: any;
  export const ConsoleSqlOutlined: any;
  export const HddOutlined: any;
  export const DesktopOutlined: any;
  export const MobileOutlined: any;
  export const TabletOutlined: any;
  export const WindowsOutlined: any;
  export const AppleOutlined: any;
  export const AndroidOutlined: any;
  export const ChromeOutlined: any;
  export const GithubOutlined: any;
  export const CodeSandboxOutlined: any;
  export const GitlabOutlined: any;
  export const DingtalkOutlined: any;
  export const WeiboOutlined: any;
  export const WechatOutlined: any;
  export const YoutubeOutlined: any;
  export const AlibabaOutlined: any;
  export const SlackOutlined: any;
  export const ZhihuOutlined: any;
}

declare module "dayjs" {
  const dayjs: any;
  export default dayjs;
}

declare module "react-i18next" {
  export function useTranslation(): { t: (key: string) => string; i18n: any };
  export const Trans: any;
  export const withTranslation: any;
}

declare module "react-force-graph-2d" {
  import { Component } from "react";
  class ForceGraph2D extends Component<any> {}
  export default ForceGraph2D;
  export type ForceGraphMethods = any;
}

declare module "react-dropzone" {
  export function useDropzone(options?: Record<string, any>): Record<string, any>;
  export default function Dropzone(props: any): any;
}

declare module "react-window" {
  export function FixedSizeList(props: any): any;
  export function VariableSizeList(props: any): any;
  export function FixedSizeGrid(props: any): any;
}

declare module "@mui/material" {
  const _default: Record<string, unknown>;
  export default _default;
  export const Box: any;
  export const Typography: any;
  export const Button: any;
  export const TextField: any;
  export const Select: any;
  export const MenuItem: any;
  export const FormControl: any;
  export const InputLabel: any;
  export const FormHelperText: any;
  export const Dialog: any;
  export const DialogTitle: any;
  export const DialogContent: any;
  export const DialogActions: any;
  export const Table: any;
  export const TableBody: any;
  export const TableCell: any;
  export const TableContainer: any;
  export const TableHead: any;
  export const TableRow: any;
  export const Paper: any;
  export const Grid: any;
  export const Card: any;
  export const CardContent: any;
  export const CardHeader: any;
  export const CardActions: any;
  export const Chip: any;
  export const IconButton: any;
  export const Avatar: any;
  export const Badge: any;
  export const Tooltip: any;
  export const Snackbar: any;
  export const Alert: any;
  export const LinearProgress: any;
  export const CircularProgress: any;
  export const Skeleton: any;
  export const Stepper: any;
  export const Step: any;
  export const StepLabel: any;
  export const Autocomplete: any;
  export const Tabs: any;
  export const Tab: any;
  export const Switch: any;
  export const Checkbox: any;
  export const Radio: any;
  export const RadioGroup: any;
  export const Slider: any;
  export const Rating: any;
  export const Divider: any;
  export const List: any;
  export const ListItem: any;
  export const ListItemIcon: any;
  export const ListItemText: any;
  export const ListItemButton: any;
  export const Breadcrumbs: any;
  export const Link: any;
  export const Accordion: any;
  export const AccordionSummary: any;
  export const AccordionDetails: any;
  export const Drawer: any;
  export const AppBar: any;
  export const Toolbar: any;
  export const Menu: any;
  export const Popover: any;
  export const Modal: any;
  export const Fade: any;
  export const Grow: any;
  export const Slide: any;
  export const Zoom: any;
  export const Collapse: any;
  export const ThemeProvider: any;
  export const createTheme: any;
}

declare module "@mui/icons-material/Warning" {
  const WarningIcon: any;
  export default WarningIcon;
}

// Missing internal UI components that may not exist yet
declare module "@/lib/utils" {
  export function cn(...args: any[]): string;
  export function formatCurrency(value: number): string;
  export function formatDate(date: string | Date): string;
}

declare module "@/components/ui/progress" {
  export const Progress: any;
  export default Progress;
}

declare module "@/components/ui/alert" {
  export const Alert: any;
  export const AlertDescription: any;
  export const AlertTitle: any;
  export default Alert;
}

declare module "@/components/ui/Alert" {
  export const Alert: any;
  export const AlertDescription: any;
  export const AlertTitle: any;
  export default Alert;
}

declare module "@/components/ui/popover" {
  export const Popover: any;
  export const PopoverTrigger: any;
  export const PopoverContent: any;
}

declare module "@/components/ui/calendar" {
  const Calendar: any;
  export default Calendar;
}

declare module "@/components/ui/form" {
  export const Form: any;
  export const FormField: any;
  export const FormItem: any;
  export const FormLabel: any;
  export const FormControl: any;
  export const FormMessage: any;
  export const FormDescription: any;
}

declare module "@/components/ui/Spinner" {
  const Spinner: any;
  export default Spinner;
}

declare module "../../stores/useInventoryStore" {
  export function useInventoryStore(): any;
}

// UI component type declarations for shadcn-style components with PascalCase files
declare module "@/components/ui/Button" {
  export const Button: any;
  export default Button;
}
declare module "@/components/ui/button" {
  export const Button: any;
  export default Button;
}
declare module "@/components/ui/Card" {
  export const Card: any;
  export const CardHeader: any;
  export const CardTitle: any;
  export const CardContent: any;
  export const CardDescription: any;
  export const CardFooter: any;
  export default Card;
}
declare module "@/components/ui/card" {
  export * from "@/components/ui/Card";
}
declare module "@/components/ui/Badge" {
  export const Badge: any;
  export default Badge;
}
declare module "@/components/ui/badge" {
  export * from "@/components/ui/Badge";
}
declare module "@/components/ui/Tabs" {
  export const Tabs: any;
  export const TabsList: any;
  export const TabsTrigger: any;
  export const TabsContent: any;
  export default Tabs;
}
declare module "@/components/ui/tabs" {
  export * from "@/components/ui/Tabs";
}
declare module "@/components/ui/Select" {
  export const Select: any;
  export const SelectContent: any;
  export const SelectItem: any;
  export const SelectTrigger: any;
  export const SelectValue: any;
  export const SelectGroup: any;
  export const SelectLabel: any;
  export default Select;
}
declare module "@/components/ui/select" {
  export * from "@/components/ui/Select";
}
declare module "@/components/ui/Dialog" {
  export const Dialog: any;
  export const DialogContent: any;
  export const DialogHeader: any;
  export const DialogTitle: any;
  export const DialogDescription: any;
  export const DialogFooter: any;
  export const DialogTrigger: any;
  export const DialogClose: any;
  export default Dialog;
}
declare module "@/components/ui/dialog" {
  export * from "@/components/ui/Dialog";
}
declare module "@/components/ui/Tooltip" {
  export const Tooltip: any;
  export const TooltipContent: any;
  export const TooltipProvider: any;
  export const TooltipTrigger: any;
  export default Tooltip;
}
declare module "@/components/ui/tooltip" {
  export * from "@/components/ui/Tooltip";
}
declare module "@/components/ui/Input" {
  export const Input: any;
  export default Input;
}
declare module "@/components/ui/input" {
  export * from "@/components/ui/Input";
}
declare module "@/components/ui/Skeleton" {
  export const Skeleton: any;
  export default Skeleton;
}
declare module "@/components/ui/skeleton" {
  export * from "@/components/ui/Skeleton";
}
declare module "@/components/ui/ApprovalTimeline" {
  export const ApprovalTimeline: any;
  export default ApprovalTimeline;
}
declare module "@/components/ui/Textarea" {
  export const Textarea: any;
  export default Textarea;
}
declare module "@/components/ui/textarea" {
  export * from "@/components/ui/Textarea";
}
declare module "@/components/ui/Separator" {
  export const Separator: any;
  export default Separator;
}
declare module "@/components/ui/separator" {
  export * from "@/components/ui/Separator";
}
declare module "@/components/ui/Avatar" {
  export const Avatar: any;
  export const AvatarImage: any;
  export const AvatarFallback: any;
  export default Avatar;
}
declare module "@/components/ui/avatar" {
  export * from "@/components/ui/Avatar";
}
declare module "@/components/ui/Checkbox" {
  export const Checkbox: any;
  export default Checkbox;
}
declare module "@/components/ui/checkbox" {
  export * from "@/components/ui/Checkbox";
}
declare module "@/components/ui/Label" {
  export const Label: any;
  export default Label;
}
declare module "@/components/ui/label" {
  export * from "@/components/ui/Label";
}
declare module "@/components/ui/Switch" {
  export const Switch: any;
  export default Switch;
}
declare module "@/components/ui/switch" {
  export * from "@/components/ui/Switch";
}
declare module "@/components/ui/ScrollArea" {
  export const ScrollArea: any;
  export const ScrollBar: any;
  export default ScrollArea;
}
declare module "@/components/ui/scroll-area" {
  export * from "@/components/ui/ScrollArea";
}
declare module "@/components/ui/Sheet" {
  export const Sheet: any;
  export const SheetContent: any;
  export const SheetHeader: any;
  export const SheetTitle: any;
  export const SheetDescription: any;
  export const SheetFooter: any;
  export const SheetTrigger: any;
  export const SheetClose: any;
  export default Sheet;
}
declare module "@/components/ui/sheet" {
  export * from "@/components/ui/Sheet";
}
declare module "@/components/ui/DropdownMenu" {
  export const DropdownMenu: any;
  export const DropdownMenuContent: any;
  export const DropdownMenuItem: any;
  export const DropdownMenuTrigger: any;
  export const DropdownMenuSeparator: any;
  export const DropdownMenuLabel: any;
  export const DropdownMenuGroup: any;
  export default DropdownMenu;
}
declare module "@/components/ui/dropdown-menu" {
  export * from "@/components/ui/DropdownMenu";
}
declare module "@/components/ui/Drawer" {
  export const Drawer: any;
  export const DrawerContent: any;
  export const DrawerHeader: any;
  export const DrawerTitle: any;
  export const DrawerFooter: any;
  export const DrawerTrigger: any;
  export const DrawerClose: any;
  export default Drawer;
}
declare module "@/components/ui/drawer" {
  export * from "@/components/ui/Drawer";
}
declare module "@/components/ui/RadioGroup" {
  export const RadioGroup: any;
  export const RadioGroupItem: any;
  export default RadioGroup;
}
declare module "@/components/ui/radio-group" {
  export * from "@/components/ui/RadioGroup";
}
declare module "@/components/ui/Slider" {
  export const Slider: any;
  export default Slider;
}
declare module "@/components/ui/slider" {
  export * from "@/components/ui/Slider";
}
declare module "@/components/ui/AlertDialog" {
  export const AlertDialog: any;
  export const AlertDialogContent: any;
  export const AlertDialogHeader: any;
  export const AlertDialogTitle: any;
  export const AlertDialogDescription: any;
  export const AlertDialogFooter: any;
  export const AlertDialogTrigger: any;
  export const AlertDialogAction: any;
  export const AlertDialogCancel: any;
  export default AlertDialog;
}
declare module "@/components/ui/alert-dialog" {
  export * from "@/components/ui/AlertDialog";
}
declare module "@/components/ui/Pagination" {
  export const Pagination: any;
  export default Pagination;
}
declare module "@/components/ui/pagination" {
  export * from "@/components/ui/Pagination";
}
declare module "@/components/ui/EmptyState" {
  export const EmptyState: any;
  export default EmptyState;
}
declare module "@/components/ui/StatCard" {
  export const StatCard: any;
  export default StatCard;
}
declare module "@/components/ui/StatusBadge" {
  export const StatusBadge: any;
  export default StatusBadge;
}
declare module "@/components/ui/ConfirmDialog" {
  export const ConfirmDialog: any;
  export default ConfirmDialog;
}
declare module "@/components/ui/LoadingOverlay" {
  export const LoadingOverlay: any;
  export default LoadingOverlay;
}
declare module "@/components/ui/TreeSelect" {
  export const TreeSelect: any;
  export default TreeSelect;
}
declare module "@/components/ui/tree-select" {
  export * from "@/components/ui/TreeSelect";
}
declare module "@/components/ui/Cascader" {
  export const Cascader: any;
  export default Cascader;
}
declare module "@/components/ui/cascader" {
  export * from "@/components/ui/Cascader";
}
declare module "@/components/ui/DatePicker" {
  export const DatePicker: any;
  export default DatePicker;
}
declare module "@/components/ui/date-picker" {
  export * from "@/components/ui/DatePicker";
}
declare module "@/components/ui/Transfer" {
  export const Transfer: any;
  export default Transfer;
}
declare module "@/components/ui/transfer" {
  export * from "@/components/ui/Transfer";
}
declare module "@/components/ui/Upload" {
  export const Upload: any;
  export default Upload;
}
declare module "@/components/ui/upload" {
  export * from "@/components/ui/Upload";
}
