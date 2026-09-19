export const DASHBOARD_STATUS = Object.freeze({
  loading: "loading",
  proven: "proven",
  cached: "cached",
  unavailable: "unavailable",
  deferred: "deferred"
});

const STATUS_COPY = Object.freeze({
  [DASHBOARD_STATUS.loading]: {
    title: "Awaiting dashboard data",
    text: "Dashboard is open. Current records have not loaded yet."
  },
  [DASHBOARD_STATUS.proven]: {
    title: "Dashboard data available",
    text: "Current dashboard statistics are available from dashboard_stats/global."
  },
  [DASHBOARD_STATUS.cached]: {
    title: "Using cached dashboard data",
    text: "Showing the last saved dashboard snapshot while current records are unavailable."
  },
  [DASHBOARD_STATUS.unavailable]: {
    title: "Data unavailable",
    text: "Dashboard statistics are not currently available."
  },
  [DASHBOARD_STATUS.deferred]: {
    title: "Deferred",
    text: "This dashboard intelligence is not enabled yet."
  }
});

export function getDashboardStatusCopy(status = DASHBOARD_STATUS.loading) {
  return STATUS_COPY[status] || STATUS_COPY[DASHBOARD_STATUS.loading];
}
