'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StatusBadge, EmptyState, VideoIcon, TableSkeleton } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { matchesSearch, safeFormatDate } from '@/lib/format';
import type { Submission, SubmissionStatus } from '@/types';

export default function MySubmissionsPage() {
  const { user } = useAuth();
  const { getCache, setCache } = useDataCache();
  const searchParams = useSearchParams();

  const getCacheKey = (filter: string) => {
    return `submissions:submitter:${user?.id || 'unknown'}:${filter || 'all'}`;
  };

  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    return getCache<Submission[]>(getCacheKey('all')) || [];
  });
  const [loading, setLoading] = useState(() => {
    return !getCache<Submission[]>(getCacheKey('all'));
  });
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | ''>(() => {
    const param = searchParams.get('status');
    return (param as SubmissionStatus) || '';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchSubmissions = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const params = new URLSearchParams();
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      
      const cacheKey = `submissions:submitter:${user?.id || 'unknown'}:${statusFilter || 'all'}`;
      
      const cachedData = getCache<Submission[]>(cacheKey);
      if (cachedData && showLoading) {
        setSubmissions(cachedData);
        setLoading(false);
        setError(null);
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
  }, [statusFilter, user?.id, getCache, setCache]);

  useEffect(() => {
    if (!user) return;
    
    const cacheKey = `submissions:submitter:${user.id}:${statusFilter || 'all'}`;
    const cachedData = getCache<Submission[]>(cacheKey);
    
    if (cachedData) {
      setSubmissions(cachedData);
      setLoading(false);
      fetchSubmissions(false);
    } else {
      setLoading(true);
      fetchSubmissions(true);
    }
  }, [statusFilter, user, fetchSubmissions, getCache]);

  const filteredSubmissions = submissions.filter((submission) =>
    matchesSearch(submission.title, searchQuery)
  );

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubmissions = filteredSubmissions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const statusOptions: { value: SubmissionStatus | ''; label: string }[] = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewing', label: 'In Review' },
    { value: 'revision_requested', label: 'Revision Requested' },
    { value: 'approved', label: 'Approved' },
  ];

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-black">All Submissions</h1>
        <p className="mt-3 text-lg font-light tracking-wide text-black/70">
          Search, filter, and manage your video submissions.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-black">Submissions</h2>
        <Link
          href="/submissions/new"
          className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:shadow-[#061E26]/40 hover:scale-105 transition-all duration-200"
        >
          <svg className="-ml-1 h-5 w-5 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Submission
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-black/10 p-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2.5">
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
                : 'Create your first submission to get started'
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
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="relative px-6 py-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {paginatedSubmissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {submission.title}
                          </span>
                          {submission.description && (
                            <span className="text-sm text-slate-500 truncate max-w-xs mt-1">
                              {submission.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={submission.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {safeFormatDate(submission.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {safeFormatDate(submission.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/submissions/${submission.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
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

          <div className="md:hidden space-y-3">
            {paginatedSubmissions.map((submission) => (
              <Link
                key={submission.id}
                href={`/submissions/${submission.id}`}
                className="block bg-white rounded-xl shadow-sm border border-slate-200/50 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200"
              >
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 mb-1">
                      {submission.title}
                    </h3>
                    {submission.description && (
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {submission.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <StatusBadge status={submission.status} size="sm" />
                    <span className="text-xs text-slate-400">
                      {safeFormatDate(submission.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span>Updated: {safeFormatDate(submission.updated_at)}</span>
                    <span className="text-blue-600 font-semibold inline-flex items-center gap-1">
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
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
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
