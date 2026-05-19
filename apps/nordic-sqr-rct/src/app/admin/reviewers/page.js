import { redirect } from 'next/navigation';

export default function ReviewersRedirect() {
  redirect('/admin/users');
}
