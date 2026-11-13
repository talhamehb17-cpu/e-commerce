/* Central icon set. Lucide for UI glyphs (brand marks are hand-rolled SVGs because
   lucide dropped social icons). Tree-shaken by the bundler. */
export {
  Search, ShoppingBag, Heart, User, Menu, X, ChevronRight, ChevronLeft, ChevronDown, Star,
  Plus, Minus, Eye, Truck, ShieldCheck, RotateCcw, Sparkles, Check, ArrowRight, ArrowUpRight,
  Mail, Phone, MapPin, Lock, LogOut, Package, House as Home, Settings, LayoutDashboard,
  ChartColumn as BarChart3, Boxes, Tag, Ticket, Users, MessageSquare, Image as ImageIcon, Palette, Coins, Globe,
  MailCheck, Trash2, Pencil, Upload, Funnel as Filter, SlidersHorizontal, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle,
  LoaderCircle as Loader2, CreditCard, Gift, Ruler, Leaf, Award, ZoomIn, Grid2x2, List, Download, RefreshCw,
  ExternalLink, Send, BadgeCheck, TrendingUp, Wallet, ClipboardList, Layers, PanelLeftClose,
  PanelLeft, MoreHorizontal, Ban, UserCheck, FileText, Percent, Factory, Store, Flag, EyeOff,
  ArrowUpDown, Printer, CircleDollarSign, Sun, Moon, GripVertical, Copy, KeyRound, Save, Database, Bell,
  ArrowLeft, ShoppingCart, Calendar, ArrowUp, ArrowDown, Info, CircleHelp as HelpCircle, Sparkle, PackageCheck, PackageX,
  Images, Sliders, LayoutGrid, Building2, Wallet as WalletIcon, ChartPie, ChartLine,
} from 'lucide-react';

const svg = (props) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: props.size ?? 18,
  height: props.size ?? 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: props.strokeWidth ?? 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
});

export function Instagram(props) {
  return (
    <svg {...svg(props)} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Facebook(props) {
  return (
    <svg {...svg(props)} aria-hidden="true">
      <path d="M15.5 21v-7.4h2.6l.4-3h-3V8.7c0-.9.3-1.5 1.6-1.5H18.7V4.5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H9.6v3h2.7V21z" />
    </svg>
  );
}

export function XSocial(props) {
  return (
    <svg {...svg(props)} aria-hidden="true">
      <path d="M4 4l7.2 9.1L4.4 20h2.3l5.5-5.9 4.7 5.9H20l-7.4-9.3L19.4 4h-2.3l-5.1 5.5L7.7 4z" />
    </svg>
  );
}

export function Tiktok(props) {
  return (
    <svg {...svg(props)} aria-hidden="true">
      <path d="M14 4v9.5a3.3 3.3 0 1 1-2.6-3.2" />
      <path d="M14 4c.4 2.4 1.9 3.9 4.3 4.1" />
    </svg>
  );
}

export function Whatsapp(props) {
  return (
    <svg {...svg(props)} aria-hidden="true">
      <path d="M20 11.6a8 8 0 0 1-11.9 7L4 20l1.4-4A8 8 0 1 1 20 11.6z" />
      <path d="M9 9.4c0 2.8 2.3 5 5 5 .6 0 1-.4 1-1l-1.4-.8-1 .9c-1-.4-1.8-1.2-2.2-2.2l.9-1L10.5 9c0-.6-.6-1-1-1s-.5.7-.5 1.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}
