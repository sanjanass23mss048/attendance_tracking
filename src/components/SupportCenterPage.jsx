import { Info, Phone, Mail, Clock, MessageCircle } from 'lucide-react';

const SUPPORT_PHONE = '8072180274';
const SUPPORT_EMAIL = 'info@riobizsols.com';
const CHAT_URL = `https://wa.me/91${SUPPORT_PHONE}`;

export default function SupportCenterPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-6 sm:py-10">
      <div className="w-full max-w-md rounded-3xl border border-indigo-900/20 bg-[#0b1437] p-6 text-white shadow-xl sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <Info size={26} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Need Help?
            </h2>
            <p className="mt-1 text-sm text-indigo-100/90">Support Center</p>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock size={20} />
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500">Working hours</p>
            <p className="text-base font-bold text-slate-900">
              9:00 AM – 5:00 PM · Monday to Friday
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Phone size={20} />
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500">Support number</p>
            <p className="text-base font-bold text-slate-900 select-text">{SUPPORT_PHONE}</p>
          </div>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Mail size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">Email</p>
            <p className="truncate text-base font-bold text-slate-900">{SUPPORT_EMAIL}</p>
          </div>
        </a>
        <a
          href={CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-green-200 hover:shadow-md sm:col-span-2"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <MessageCircle size={20} />
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500">Chat support</p>
            <p className="text-base font-bold text-slate-900">Chat on WhatsApp</p>
            <p className="text-xs text-gray-500">Opens a chat with {SUPPORT_PHONE}</p>
          </div>
        </a>
      </div>
    </div>
  );
}
