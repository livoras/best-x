import { redirect } from 'next/navigation';

export default function HomePage() {
  // 重定向到 extraction 页面
  redirect('/extraction');
}