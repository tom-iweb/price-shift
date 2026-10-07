import type { Metadata } from 'next';
import './globals.css';
import './users.css';
import './auth.css';

export const metadata: Metadata = { title: 'PriceShift | Margin Control', description: 'Supplier price and margin management' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
