const STORAGE_KEY = "salary-flow-settings";
const HOLIDAY_RULES = {
  2026: {
    holidays: [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2026-02-20",
      "2026-02-21",
      "2026-02-22",
      "2026-02-23",
      "2026-04-04",
      "2026-04-05",
      "2026-04-06",
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
      "2026-05-04",
      "2026-05-05",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ],
    extraWorkdays: [
      "2026-01-04",
      "2026-02-14",
      "2026-02-28",
      "2026-05-09",
      "2026-09-20",
      "2026-10-10",
    ],
  },
};

Object.values(HOLIDAY_RULES).forEach((rule) => {
  rule.holidaySet = new Set(rule.holidays);
  rule.extraWorkdaySet = new Set(rule.extraWorkdays);
});

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

const form = document.querySelector("#salary-form");
const controlsPanel = document.querySelector("#controlsPanel");
const summaryPanel = document.querySelector("#summaryPanel");
const monthlySalaryInput = document.querySelector("#monthlySalary");
const startTimeInput = document.querySelector("#startTime");
const endTimeInput = document.querySelector("#endTime");
const editButton = document.querySelector("#editButton");

const todayProgressText = document.querySelector("#todayProgressText");
const todayStatusText = document.querySelector("#todayStatusText");
const todayProgressBar = document.querySelector("#todayProgressBar");
const todayEarnedText = document.querySelector("#todayEarnedText");
const dailyTargetText = document.querySelector("#dailyTargetText");
const monthEarnedText = document.querySelector("#monthEarnedText");
const monthWorkdayText = document.querySelector("#monthWorkdayText");

let configured = false;

function loadSettings() {
  const fallback = {
    monthlySalary: "",
    startTime: "09:00",
    endTime: "18:00",
    configured: false,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

function saveSettings() {
  const payload = {
    monthlySalary: monthlySalaryInput.value,
    startTime: startTimeInput.value,
    endTime: endTimeInput.value,
    configured,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(timeValue) {
  const [hours = "0", minutes = "0"] = timeValue.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function hasValidSettings() {
  const monthlySalary = Number(monthlySalaryInput.value) || 0;
  const startMinutes = parseTimeToMinutes(startTimeInput.value);
  const endMinutes = parseTimeToMinutes(endTimeInput.value);
  return monthlySalary > 0 && endMinutes > startMinutes;
}

function isWorkday(date) {
  const yearRules = HOLIDAY_RULES[date.getFullYear()];
  const dayKey = formatDateKey(date);
  const day = date.getDay();
  const defaultWorkday = day !== 0 && day !== 6;

  if (!yearRules) {
    return defaultWorkday;
  }

  if (yearRules.extraWorkdaySet.has(dayKey)) {
    return true;
  }

  if (yearRules.holidaySet.has(dayKey)) {
    return false;
  }

  return defaultWorkday;
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getMonthDates(referenceDate) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const dates = [];

  for (let date = 1; date <= lastDay.getDate(); date += 1) {
    dates.push(new Date(year, month, date));
  }

  return { dates };
}

function getWorkdayStats(referenceDate) {
  const { dates } = getMonthDates(referenceDate);
  const workdays = dates.filter(isWorkday);
  const completedBeforeToday = workdays.filter((date) => date < new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())).length;
  const todayIsWorkday = isWorkday(referenceDate);

  return {
    totalWorkdays: workdays.length,
    completedBeforeToday,
    todayIsWorkday,
    workdays,
  };
}

function getProgressSnapshot(now, startMinutes, endMinutes) {
  const totalMinutes = endMinutes - startMinutes;
  if (totalMinutes <= 0) {
    return { elapsedMinutes: 0, totalMinutes: 0, progress: 0 };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const elapsedMinutes = clamp(currentMinutes - startMinutes, 0, totalMinutes);

  return {
    elapsedMinutes,
    totalMinutes,
    progress: elapsedMinutes / totalMinutes,
  };
}

function updateView() {
  const showSummary = configured && hasValidSettings();
  controlsPanel.classList.toggle("is-hidden", showSummary);
  summaryPanel.classList.toggle("is-hidden", !showSummary);
}

function updateDashboard() {
  const now = new Date();
  const monthlySalary = Number(monthlySalaryInput.value) || 0;
  const startMinutes = parseTimeToMinutes(startTimeInput.value);
  const endMinutes = parseTimeToMinutes(endTimeInput.value);
  const { totalWorkdays, completedBeforeToday, todayIsWorkday } = getWorkdayStats(now);
  const { elapsedMinutes, totalMinutes, progress } = getProgressSnapshot(now, startMinutes, endMinutes);

  const dailySalary = totalWorkdays > 0 ? monthlySalary / totalWorkdays : 0;
  const effectiveTodayProgress = todayIsWorkday ? progress : 0;
  const todayEarned = dailySalary * effectiveTodayProgress;
  const monthEarned = dailySalary * completedBeforeToday + todayEarned;

  todayProgressText.textContent = `${Math.round(effectiveTodayProgress * 100)}%`;
  todayProgressBar.style.width = `${effectiveTodayProgress * 100}%`;

  todayEarnedText.textContent = formatCurrency(todayEarned);
  dailyTargetText.textContent = `今日目标 ${formatCurrency(dailySalary)}`;
  monthEarnedText.textContent = formatCurrency(monthEarned);
  monthWorkdayText.textContent = `本月工作日 ${totalWorkdays} 天`;

  if (!monthlySalary) {
    todayStatusText.textContent = "先输入月薪，页面就会开始实时计算。";
  } else if (totalMinutes <= 0) {
    todayStatusText.textContent = "下班时间需要晚于上班时间。";
  } else if (!todayIsWorkday) {
    todayStatusText.textContent = "今天按中国节假日调休规则是休息日，今日收入按 0 计算。";
  } else if (effectiveTodayProgress <= 0) {
    todayStatusText.textContent = "今天还没到上班时间，计时待开始。";
  } else if (effectiveTodayProgress >= 1) {
    todayStatusText.textContent = "今天已经下班，今日收入已计满。";
  } else {
    const leftMinutes = Math.max(totalMinutes - elapsedMinutes, 0);
    const leftHours = Math.floor(leftMinutes / 60);
    const leftRemainder = Math.round(leftMinutes % 60);
    todayStatusText.textContent = `距离下班还剩 ${leftHours} 小时 ${leftRemainder} 分钟。`;
  }
}

function hydrateForm() {
  const settings = loadSettings();
  monthlySalaryInput.value = settings.monthlySalary;
  startTimeInput.value = settings.startTime;
  endTimeInput.value = settings.endTime;
  configured = Boolean(settings.configured);
}

form.addEventListener("input", () => {
  saveSettings();
  updateDashboard();
  updateView();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!hasValidSettings()) {
    configured = false;
    saveSettings();
    updateDashboard();
    updateView();
    return;
  }

  configured = true;
  saveSettings();
  updateDashboard();
  updateView();
});

editButton.addEventListener("click", () => {
  configured = false;
  saveSettings();
  updateView();
});

hydrateForm();
updateDashboard();
updateView();
setInterval(updateDashboard, 1000);
