from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, date, timedelta
import requests, os, logging

NTFY_URL    = os.getenv("NTFY_URL", "http://ntfy:80")
NTFY_TOPIC  = os.getenv("NTFY_TOPIC", "famboard")

scheduler = BackgroundScheduler(timezone="Europe/Oslo")

log = logging.getLogger(__name__)

def _ntfy(title: str, msg: str, priority: str = "default", tags: str = ""):
    try:
        requests.post(
            f"{NTFY_URL}/{NTFY_TOPIC}",
            data=msg.encode("utf-8"),
            headers={
                "Title":    title,
                "Priority": priority,
                "Tags":     tags,
            },
            timeout=5,
        )
    except Exception as e:
        log.warning(f"ntfy send failed: {e}")

def send_task_reminders():
    from core.database import SessionLocal, Task, RecurrenceEnum
    db = SessionLocal()
    try:
        now  = datetime.now()
        wday = now.weekday()  # 0=Mon … 6=Sun
        in10 = (now + timedelta(minutes=10)).strftime("%H:%M")
        tasks = db.query(Task).filter(Task.active == True, Task.time_slot == in10).all()
        for t in tasks:
            rec = t.recurrence
            if rec == RecurrenceEnum.daily:
                pass
            elif rec == RecurrenceEnum.weekdays and wday >= 5:
                continue
            elif rec == RecurrenceEnum.weekend and wday < 5:
                continue
            _ntfy(
                title=f"Coming up: {t.name}",
                msg=f"Starting in 10 minutes at {t.time_slot} — worth {t.points} pts!",
                tags="alarm_clock",
            )
        log.info(f"Reminder check at {in10}: {len(tasks)} task(s) notified")
    finally:
        db.close()

def send_weekly_summary():
    from core.database import SessionLocal, DailyLog, Task, User, WeeklySummary
    db = SessionLocal()
    try:
        today      = date.today()
        week_start = today - timedelta(days=today.weekday())
        kids       = db.query(User).filter(User.role == "kid").all()
        for kid in kids:
            dates  = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
            logs   = db.query(DailyLog).filter(
                DailyLog.user_id == kid.id,
                DailyLog.date.in_(dates)
            ).all()
            done   = sum(1 for l in logs if l.done)
            pts    = sum((l.bonus_pts or 0) for l in logs)
            # add task base points for done logs
            for l in logs:
                if l.done and l.task:
                    pts += l.task.points
            summary = WeeklySummary(
                user_id    = kid.id,
                week_start = week_start.isoformat(),
                total_pts  = pts,
                tasks_done = done,
                tasks_total= len(logs),
            )
            db.add(summary)
            db.commit()
            _ntfy(
                title=f"Weekly summary for {kid.name}",
                msg=(
                    f"Week of {week_start}: {done}/{len(logs)} tasks done, "
                    f"{pts} points earned! Great job!"
                ),
                tags="star,trophy",
                priority="high",
            )
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(send_task_reminders, CronTrigger(minute="*"), id="reminders", replace_existing=True)
    scheduler.add_job(send_weekly_summary, CronTrigger(day_of_week="sun", hour=20, minute=0), id="weekly", replace_existing=True)
    scheduler.start()
    log.info("Scheduler started")

def shutdown_scheduler():
    scheduler.shutdown()
