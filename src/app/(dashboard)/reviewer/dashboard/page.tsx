'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StatusBadge, StatCard, FirebaseStorageUsage } from '@/components';
import { useDataCache } from '@/contexts/DataCacheContext';
import { safeDateMs, safeFormatDate } from '@/lib/format';
import type { Submission } from '@/types';

export default function ReviewerDashboardPage() {
  const { getCache, setCache } = useDataCache();
  
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    return getCache<Submission[]>(`submissions:reviewer:all`) || [];
  });
  const [loading, setLoading] = useState(() => {
    return !getCache<Submission[]>(`submissions:reviewer:all`);
  });
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const cacheKey = `submissions:reviewer:all`;
      
      const cachedData = getCache<Submission[]>(cacheKey);
      if (cachedData && showLoading) {
        setSubmissions(cachedData);
        setLoading(false);
        setError(null);
        showLoading = false;
      }
      
      const response = await fetch(`/api/submissions`);
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
  }, [getCache, setCache]);

  useEffect(() => {
    const cacheKey = `submissions:reviewer:all`;
    const cachedData = getCache<Submission[]>(cacheKey);
    
    if (cachedData) {
      setSubmissions(cachedData);
      setLoading(false);
      fetchSubmissions(false);
    } else {
      setLoading(true);
      fetchSubmissions(true);
    }
  }, [fetchSubmissions, getCache]);

  // Sort by updated_at (most recent first) for latest submissions
  const sortedSubmissions = [...submissions].sort((a, b) => {
    return safeDateMs(b.updated_at) - safeDateMs(a.updated_at);
  });

  // Get latest 3 submissions for dashboard preview
  const recentSubmissions = sortedSubmissions.slice(0, 3);

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    reviewing: submissions.filter((s) => s.status === 'reviewing').length,
    revision_requested: submissions.filter((s) => s.status === 'revision_requested').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-black">Dashboard</h1>
        <p className="mt-3 text-lg font-light tracking-wide text-black/70">
          Overview of submissions and review activity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
        <StatCard
          label="Total"
          value={stats.total}
          tone="primary"
          href="/reviewer/review"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          tone="accent"
          href="/reviewer/review?status=pending"
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
          href="/reviewer/review?status=reviewing"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        />
        <StatCard
          label="Revision Requested"
          value={stats.revision_requested}
          tone="accent"
          href="/reviewer/review?status=revision_requested"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          tone="dark"
          href="/reviewer/review?status=approved"
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
        <h2 className="text-2xl font-bold text-black">Recent Submissions</h2>
        <p className="mt-2 text-base text-black/70">
          Latest submissions awaiting review or recently updated.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-black/10 p-5 animate-pulse">
              <div className="h-4 bg-black/10 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-black/10 rounded w-1/2 mb-4"></div>
              <div className="h-6 bg-black/10 rounded w-20"></div>
            </div>
          ))}
        </div>
      )}

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

      {!loading && !error && recentSubmissions.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 p-8 text-center mb-6">
          <svg className="mx-auto h-12 w-12 text-black/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-black/60 font-medium">No submissions to review yet</p>
          <p className="text-sm text-black/40 mt-1">Submissions will appear here when they are created</p>
        </div>
      )}

      {!loading && !error && recentSubmissions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {recentSubmissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/submissions/${submission.id}`}
              className="block bg-white rounded-xl shadow-sm border border-black/10 p-5 hover:shadow-lg hover:border-[#061E26]/30 transition-all duration-200 group"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-black group-hover:text-[#061E26] transition-colors truncate">
                    {submission.title}
                  </h3>
                  {submission.description && (
                    <p className="text-sm text-black/50 line-clamp-2 mt-1">
                      {submission.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <StatusBadge status={submission.status} size="sm" />
                  <span className="text-xs text-black/40">
                    {safeFormatDate(submission.updated_at)}
                  </span>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-black/5">
                  <span className="text-sm text-[#061E26] font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    Review submission
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {submissions.length > 3 && (
        <div className="text-center">
          <Link
            href="/reviewer/review"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-all duration-200"
          >
            View all {submissions.length} submissions
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
