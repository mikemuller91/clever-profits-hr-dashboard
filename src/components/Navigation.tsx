'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const tabs = [
  { name: 'Employees', href: '/' },
  { name: 'Candidates', href: '/candidates' },
  { name: 'Anniversaries', href: '/anniversaries' },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-cp-light">
      {/* Header */}
      <header className="bg-cp-dark text-white py-4 px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg px-3 py-2">
              <Image
                src="/cleverprofits-logo.png"
                alt="CleverProfits"
                width={150}
                height={50}
                className="h-10 w-auto"
              />
            </div>
            <div>
              <p className="text-cp-light/70 text-sm">HR Employee Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cp-light/50 text-sm">Powered by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bamboohr-logo.svg"
              alt="BambooHR"
              width={120}
              height={30}
              className="h-8 w-auto"
            />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-cp-blue text-cp-blue'
                      : 'border-transparent text-cp-gray hover:text-cp-dark hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-8 text-center text-cp-gray text-sm">
        <p>Data sourced from BambooHR</p>
      </div>
    </div>
  );
}
