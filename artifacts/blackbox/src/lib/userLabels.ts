export const USER_DISPLAY_NAMES: Record<string, string> = {
  admin: "Admin",
  analyst: "SOC Analyst",
  dev_lead: "Security Engineer",
  hr_admin: "HR Manager",
  cfo: "Finance Manager",
  ceo: "Executive",
  unknown_user: "Intern",
  attacker: "Guest",
};

export function displayUserName(userName: string) {
  return USER_DISPLAY_NAMES[userName] ?? userName;
}