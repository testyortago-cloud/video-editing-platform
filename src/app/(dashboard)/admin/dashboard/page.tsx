'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StatusBadge, EmptyState, VideoIcon, TableSkeleton, StatCard, FirebaseStorageUsage } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { matchesSearch, safeDateMs, safeFormatDate } from '@/lib/format';
import type { Submission, SubmissionStatus } from '@/types';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { getCache, setCache, hasCache } = useDataCache();
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Initialize with cache if available
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    const cacheKey = `submissions:admin:all`;
    return getCache<Submission[]>(cacheKey) || [];
  });
  const [loading, setLoading] = useState(() => {
    const cacheKey = `submissions:admin:all`;
    return !getCache<Submission[]>(cacheKey);
  });
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const params = new URLSearchParams();
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      
      const cacheKey = `submissions:admin:${statusFilter || 'all'}`;
      
      // Check cache first
      const cachedData = getCache<Submission[]>(cacheKey);
      if (cachedData && showLoading) {
        setSubmissions(cachedData);
        setLoading(false);
        setError(null);
        // Still fetch in background to refresh
        showLoading = false;
      }
      
      const response = await fetch(`/api/submissions?${params.toString()}`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch submissions');
      }

      setSubmissions(data.data);
      setCache(cacheKey, data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, getCache, setCache]);

  useEffect(() => {
    const cacheKey = `submissions:admin:${statusFilter || 'all'}`;
    const cachedData = getCache<Submission[]>(cacheKey);
    
    if (cachedData) {
      // Use cached data immediately, no skeleton
      setSubmissions(cachedData);
      setLoading(false);
      // Fetch fresh data in background
      fetchSubmissions(false);
    } else {
      // No cache, fetch with loading
      setLoading(true);
      fetchSubmissions(true);
    }
  }, [statusFilter, getCache, fetchSubmissions]);

  const filteredSubmissions = submissions.filter((submission) =>
    matchesSearch(submission.title, searchQuery)
  );

  // Sort by updated_at (most recent first) for latest submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    return safeDateMs(b.updated_at) - safeDateMs(a.updated_at);
  });

  // Get latest 3 submissions for dashboard preview
  const latestSubmissions = sortedSubmissions.slice(0, 3);

  // Pagination logic for full list
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubmissions = filteredSubmissions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const statusOptions: { value: SubmissionStatus | ''; label: string }[] = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewing', label: 'In Review' },
    { value: 'approved', label: 'Approved' },
  ];

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    reviewing: submissions.filter((s) => s.status === 'reviewing').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-black">Admin Dashboard</h1>
        <p className="mt-3 text-lg font-light tracking-wide text-black/70">
          Overview of all submissions and system activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatCard
          label="Total Submissions"
          value={stats.total}
          tone="primary"
          onClick={() => { setStatusFilter(''); document.getElementById('admin-submissions')?.scrollIntoView({ behavior: 'smooth' }); }}
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          tone="accent"
          onClick={() => { setStatusFilter('pending'); document.getElementById('admin-submissions')?.scrollIntoView({ behavior: 'smooth' }); }}
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        />
        <StatCard
          label="In Review"
          value={stats.reviewing}
          tone="secondary"
          onClick={() => { setStatusFilter('reviewing'); document.getElementById('admin-submissions')?.scrollIntoView({ behavior: 'smooth' }); }}
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          tone="dark"
          onClick={() => { setStatusFilter('approved'); document.getElementById('admin-submissions')?.scrollIntoView({ behavior: 'smooth' }); }}
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        />
      </div>

      <div className="mb-10">
        <FirebaseStorageUsage />
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-black">Latest Updates</h2>
      </div>

      {!loading && !error && latestSubmissions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/10">
              <thead className="bg-gradient-to-r from-white to-black/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="relative px-6 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black/5">
                {latestSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-black/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-black group-hover:text-[#061E26] transition-colors">
                          {submission.title}
                        </span>
                        {submission.description && (
                          <span className="text-sm text-black/50 truncate max-w-xs mt-1">
                            {submission.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={submission.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/50">
                      {safeFormatDate(submission.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/submissions/${submission.id}`}
                        className="inline-flex items-center gap-1 text-[#061E26] hover:text-black font-semibold transition-colors"
                      >
                        View
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && latestSubmissions.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 p-6 mb-6">
          <p className="text-sm text-black/60 text-center">No recent submissions</p>
        </div>
      )}

      {submissions.length > 3 && (
        <div className="mt-6 text-center">
          <Link
            href="/submissions"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-all duration-200"
          >
            View All Submissions ({submissions.length})
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      <div id="admin-submissions" className="mb-6 mt-8 scroll-mt-4">
        <h2 className="text-2xl font-bold text-black">All Submissions</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-black/10 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Search submissions
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-black/20 rounded-lg text-sm placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] transition-shadow"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <label htmlFor="status" className="sr-only">
              Filter by status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | '')}
              className="block w-full px-3 py-2.5 border border-black/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] transition-shadow"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 p-6">
          <TableSkeleton rows={5} />
        </div>
      )}

      {!loading && !error && filteredSubmissions.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/50">
          <EmptyState
            title="No submissions found"
            description={
              searchQuery || statusFilter
                ? 'Try adjusting your filters'
                : 'No submissions have been created yet'
            }
            icon={<VideoIcon />}
            action={
              !searchQuery && !statusFilter ? (
                <Link
                  href="/submissions/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Submission
                </Link>
              ) : undefined
            }
          />
        </div>
      )}

      {!loading && !error && filteredSubmissions.length > 0 && (
        <>
          {/* Desktop table view */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-black/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black/10">
                <thead className="bg-gradient-to-r from-white to-black/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="relative px-6 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black/5">
                {paginatedSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-black/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-black group-hover:text-[#061E26] transition-colors">
                          {submission.title}
                        </span>
                        {submission.description && (
                          <span className="text-sm text-black/50 truncate max-w-xs mt-1">
                            {submission.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={submission.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/50">
                      {safeFormatDate(submission.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/50">
                      {safeFormatDate(submission.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/submissions/${submission.id}`}
                        className="inline-flex items-center gap-1 text-[#061E26] hover:text-black font-semibold transition-colors"
                      >
                        View
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {paginatedSubmissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/submissions/${submission.id}`}
              className="block bg-white rounded-xl shadow-sm border border-black/10 p-5 hover:shadow-lg hover:border-[#061E26]/30 transition-all duration-200"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-black mb-1">
                    {submission.title}
                  </h3>
                  {submission.description && (
                    <p className="text-sm text-black/50 line-clamp-2">
                      {submission.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <StatusBadge status={submission.status} size="sm" />
                  <span className="text-xs text-black/40">
                    {safeFormatDate(submission.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-black/50 pt-3 border-t border-black/10">
                  <span>Updated: {safeFormatDate(submission.updated_at)}</span>
                  <span className="text-[#061E26] font-semibold inline-flex items-center gap-1">
                    View
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIndex, filteredSubmissions.length)}</span> of{' '}
                  <span className="font-medium">{filteredSubmissions.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === currentPage
                          ? 'z-10 bg-[#061E26]/10 border-[#061E26] text-[#061E26]'
                          : 'bg-white border-black/20 text-black/50 hover:bg-black/5'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </>
      )}
    </div>
  );
}

