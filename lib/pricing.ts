export type Status = 'cost_pending' | 'approved' | 'applied' | 'ignored';
export type Product = { id: string; sku: string; name: string; category: string; brand: string; supplier: string; currentCost: number; newCost: number; sellingPrice: number; status: Status; target?: number; minimum?: number; updatedAt: string };
export const settings = { target: 35, markup: 55, minimum: 25 };
export const products: Product[] = [
  ['PS-1001','Ashford Extending Dining Table','Dining Tables','Oakwood Heritage','Heritage Joinery Ltd',520,648,1099,'cost_pending'],
  ['PS-1002','Marcel Velvet Dining Chair','Dining Chairs','Maison Belmont','Milano Casa Imports',118,139,259,'cost_pending'],
  ['PS-1003','Harlow Cane Sideboard','Sideboards','Oakwood Heritage','Heritage Joinery Ltd',410,438,899,'approved'],
  ['PS-1004','Dorset Spindle-back Chair','Dining Chairs','Oakwood Heritage','Heritage Joinery Ltd',72,88,179,'cost_pending'],
  ['PS-1005','Montreux Bar Stool','Bar Stools','Maison Belmont','Milano Casa Imports',94,104,229,'cost_pending'],
  ['PS-1006','Windsor Refrectory Table','Dining Tables','Oakwood Heritage','Heritage Joinery Ltd',675,708,1399,'applied'],
  ['PS-1007','Bayswater Boucle Bench','Benches','Cotswold Living','Northfield Furnishings',190,244,429,'cost_pending'],
  ['PS-1008','Luca Marble Console','Sideboards','Maison Belmont','Milano Casa Imports',335,355,749,'approved'],
  ['PS-1009','Pembroke Storage Bench','Benches','Cotswold Living','Northfield Furnishings',144,176,319,'cost_pending'],
  ['PS-1010','Kensington Counter Stool','Bar Stools','Maison Belmont','Milano Casa Imports',81,85,199,'cost_pending'],
].map(([sku,name,category,brand,supplier,currentCost,newCost,sellingPrice,status]) => ({ id: String(sku), sku: String(sku), name: String(name), category: String(category), brand: String(brand), supplier: String(supplier), currentCost: Number(currentCost), newCost: Number(newCost), sellingPrice: Number(sellingPrice), status: status as Status, updatedAt: '2026-10-06' }));
export function calc(p: Product) { const increase=(p.newCost-p.currentCost)/p.currentCost*100; const currentMargin=(p.sellingPrice-p.currentCost)/p.sellingPrice*100; const newMargin=(p.sellingPrice-p.newCost)/p.sellingPrice*100; const markup=(p.sellingPrice-p.currentCost)/p.currentCost*100; return { increase, currentMargin, newMargin, impact:p.currentCost-p.newCost, recommended:p.newCost*(1+markup/100) }; }
export const gbp = (n: number) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
