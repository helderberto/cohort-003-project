import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import {
  getCourseRevenueSummary,
  getCourseEnrollmentSummary,
  getCourseCompletionRate,
  getModuleQuizPassRates,
  getLessonDropoff,
} from "~/services/analyticsService";
import { getCourseById } from "~/services/courseService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ArrowUpDown,
  BarChart3,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [{ title: `Analytics: ${title} — Cadence` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }

  const user = getUserById(currentUserId);
  if (!user || (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)) {
    throw data("Only instructors and admins can access this page.", { status: 403 });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseById(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only view analytics for your own courses.", { status: 403 });
  }

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "all";

  let from: Date | undefined;
  const now = new Date();
  if (range === "30d") {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range === "90d") {
    from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  const to = from ? now : undefined;

  const revenue = getCourseRevenueSummary({ courseId, from, to });
  const enrollment = getCourseEnrollmentSummary({ courseId, from, to });
  const completion = getCourseCompletionRate({ courseId, from, to });
  const quizPassRates = getModuleQuizPassRates({ courseId, from, to });
  const lessonDropoff = getLessonDropoff({ courseId });

  return {
    course: { id: course.id, title: course.title },
    revenue,
    enrollment,
    completion,
    quizPassRates,
    lessonDropoff,
    range,
  };
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type SortField = "date" | "amount";
type SortDir = "asc" | "desc";

export default function CourseAnalytics({ loaderData }: Route.ComponentProps) {
  const { course, revenue, enrollment, completion, quizPassRates, lessonDropoff, range } = loaderData;
  const [, setSearchParams] = useSearchParams();
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleRangeChange(value: string) {
    setSearchParams(value === "all" ? {} : { range: value });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sortedTransactions = [...revenue.transactions].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "date") {
      return a.date.localeCompare(b.date) * dir;
    }
    return (a.pricePaid - b.pricePaid) * dir;
  });

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/instructor/${course.id}`} className="hover:text-foreground">
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Select value={range} onValueChange={handleRangeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-md bg-green-100 p-2 dark:bg-green-900/30">
              <DollarSign className="size-5 text-green-700 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(revenue.totalRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-md bg-blue-100 p-2 dark:bg-blue-900/30">
              <Users className="size-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enrollments</p>
              <p className="text-2xl font-bold">{enrollment.totalEnrollments}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-md bg-purple-100 p-2 dark:bg-purple-900/30">
              <TrendingUp className="size-5 text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">{completion.completionRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">Revenue Over Time</h2>
        </CardHeader>
        <CardContent>
          {revenue.timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenue.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(142, 71%, 45%)"
                  fill="hsl(142, 71%, 45%)"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No revenue data for this period.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">Transactions</h2>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("date")}
                      >
                        Date
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 text-right font-medium">
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("amount")}
                      >
                        Amount
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th className="pb-2 font-medium">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((tx, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">{tx.studentName}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {tx.studentEmail}
                      </td>
                      <td className="py-2.5 text-right">
                        {formatCurrency(tx.pricePaid)}
                      </td>
                      <td className="py-2.5">{tx.country ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No transactions for this period.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Chart */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">Enrollments Over Time</h2>
        </CardHeader>
        <CardContent>
          {enrollment.timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={enrollment.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [Number(value), "Enrollments"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(217, 91%, 60%)"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No enrollment data for this period.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Module Quiz Pass Rates */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">Quiz Pass Rates by Module</h2>
        </CardHeader>
        <CardContent>
          {quizPassRates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Module</th>
                    <th className="pb-2 text-right font-medium">Attempts</th>
                    <th className="pb-2 text-right font-medium">Pass Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {quizPassRates.map((mod, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5">{mod.moduleTitle}</td>
                      <td className="py-2.5 text-right">{mod.attemptCount}</td>
                      <td className="py-2.5 text-right">{mod.passRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No quiz data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lesson Drop-off Funnel */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">Lesson Drop-off Funnel</h2>
        </CardHeader>
        <CardContent>
          {lessonDropoff.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, lessonDropoff.length * 40)}>
              <BarChart data={lessonDropoff} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="lessonTitle"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip formatter={(value) => [`${Number(value)}%`, "Never Started"]} />
                <Bar dataKey="neverStartedPct" fill="hsl(0, 72%, 51%)" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No lesson data available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = `Error ${error.status}`;
    message = typeof error.data === "string" ? error.data : error.statusText;
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <BarChart3 className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <Link to="/instructor">
          <Button variant="outline">Back to Courses</Button>
        </Link>
      </div>
    </div>
  );
}
