export interface User {
  id: number;
  display_name: string | null;
  picture_url: string | null;
  is_admin: boolean;
}

export interface Store {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface MenuCategory {
  id: number;
  name: string;
  description: string | null;
  items: MenuItem[];
}

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category?: {
    id: number;
    name: string;
  };
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface Visit {
  id: number;
  store: {
    id: number;
    name: string;
  };
  table_number: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  total_amount: number;
  orders_count: number;
}

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  status: 'preparing' | 'served' | 'paid' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_at: string;
  store: {
    id: number;
    name: string;
  };
  items: OrderItem[];
}
