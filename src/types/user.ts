export interface User {
  id: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  name: string;
  bamboo_id: number | null;
  role: string;
  job_title: string | null;
  department: string;
  employee_photo: string | null;
  employment_status: string;
}
