"""Seed synthetic events. Re-running does not overwrite existing event records."""
from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.orm import Session

from backend.common.db import get_engine
from backend.common.models import Event, utcnow
from scripts.migrate import migrate

EVENTS = [
    ("Build Night: ideas into prototypes", "Bring an idea, meet a team, and build something useful in an evening. A hands-on campus session with short demos and peer feedback. This is a synthetic coursework event.", "Innovation Hub · CSED", "Club / Society", 80, [], [], 1),
    ("The AI & robotics lab", "Explore computer vision and intelligent machines through live demonstrations and a practical beginner workshop. No prior robotics experience needed. Synthetic pilot event.", "Computer Centre Auditorium", "Institute-level", 120, [], [], 2),
    ("Designing systems that scale", "From APIs to databases: a guided architecture session for computing students, followed by a small system-design challenge. Synthetic coursework event.", "CSED Seminar Hall", "Departmental", 60, ["CSED"], ["B.TECH", "M.TECH", "MCA"], 3),
    ("Unplugged: an evening on campus", "A relaxed evening of acoustic music and spoken word, with performances from across the campus community. Reserve a seat and bring a friend. Synthetic pilot event.", "Student Activity Centre", "Open / Cross-department", 200, [], [], 4),
    ("Career conversations", "Ask questions about internships, preparing a portfolio, and finding work you enjoy. An informal discussion with a fictional alumni panel. Synthetic coursework event.", "MP Hall", "Institute-level", 150, [], [], 5),
    ("Make it move: engineering challenge", "Build a simple mechanism with your team and put it to the test. A collaborative challenge for students from every engineering department. Synthetic pilot event.", "Engineering Workshop", "Open / Cross-department", 48, [], [], 6),
]


def main():
    migrate("events")
    with Session(get_engine()) as db:
        created = 0
        for title, description, venue, classification, capacity, departments, programs, days in EVENTS:
            identifier = str(uuid5(NAMESPACE_URL, "mnnit-pilot/" + title))
            if db.get(Event, identifier):
                continue
            starts = (utcnow() + timedelta(days=days)).replace(hour=12, minute=30, second=0, microsecond=0)
            db.add(Event(id=identifier, title=title, description=description, venue=venue, capacity=capacity, starts_at=starts, ends_at=starts + timedelta(hours=3), registration_deadline=starts - timedelta(hours=1), classification=classification, department_rules=departments, program_rules=programs, batch_rules=[], organizer_id="00000000-0000-0000-0000-000000000000", organizer_name="Campus Collective · Pilot", is_synthetic=True))
            created += 1
        db.commit()
    print(f"Created {created} synthetic events")


if __name__ == "__main__":
    main()
