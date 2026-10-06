// SellerSage offer ladder and unit economics (Week 5 pricing worksheet).
// Shared by the operator desk and tests so prices are defined in one place.

export const economics = {
  hourlyRate: 40,          // value of founder time, $/hour
  toolsPerMonth: 15,       // AI/API tooling per customer per month
  auditHours: 0.5,
  auditConversion: 0.25,   // 1 in 4 free audits expected to convert
  refreshHours: 3,
  supportHoursPerMonth: 1.5
};

export const auditCost = economics.auditHours * economics.hourlyRate;                     // $20
export const acquisitionCost = auditCost / economics.auditConversion;                      // $80
export const refreshCost = economics.refreshHours * economics.hourlyRate + economics.toolsPerMonth;          // $135
export const supportMonthCost = economics.supportHoursPerMonth * economics.hourlyRate + economics.toolsPerMonth; // $75

export const packages = [
  {id:'audit', label:'Free shop audit', price:0, supportMonths:0},
  {id:'refresh', label:'Shop Refresh ($300)', price:300, supportMonths:0},
  {id:'refresh-1', label:'Refresh + 1 month ($550)', price:550, supportMonths:1},
  {id:'refresh-3', label:'Refresh + 3 months ($600)', price:600, supportMonths:3},
  {id:'brand-build', label:'Full Brand Build ($1,500)', price:1500, supportMonths:null},
  {id:'unsure', label:'Not sure yet', price:null, supportMonths:null}
];

// Delivery cost including acquisition. Full Brand Build is scoped per client, so it has no fixed cost.
export function packageCost(pkg) {
  if (pkg.supportMonths === null || pkg.price === null) return null;
  if (pkg.price === 0) return auditCost;
  return refreshCost + pkg.supportMonths * supportMonthCost + acquisitionCost;
}

export const findPackage = label => packages.find(pkg => pkg.label === label) || null;
