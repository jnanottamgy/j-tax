"""Employee manual — for the person doing the work, on their first day."""

from manual_kit import (
    ROLE_THEMES, callout, cards, chapter, chips, cover, document, flow,
    navmock, qref, steps, table, toc,
)

T = ROLE_THEMES["employee"]


def build() -> str:
    parts = []

    parts.append(cover(
        T,
        "Your J-TACS<br>Handbook",
        "Everything you need on your first day and most of what you will need "
        "after that. It takes about twenty minutes to read, and you will not "
        "need to read it twice.",
        ["Signing in", "Your dashboard", "Your tasks", "Updating status",
         "Logging hours", "Your clients", "Documents", "Workpapers"],
        "J-TACS · Practice management for Indian CA firms · Employee edition",
    ))

    parts.append(toc([
        ("1", "Welcome", "What this app is and what it is for"),
        ("2", "Signing in", "Your first login and your password"),
        ("3", "Finding your way around", "The sidebar and your dashboard"),
        ("4", "Your tasks", "The daily loop — accept, work, update, submit"),
        ("5", "Your hours", "How time is counted, and your timesheet"),
        ("6", "Your clients", "What you can see and how to work on them"),
        ("7", "Documents", "Uploading, requesting and finding things"),
        ("8", "Workpapers", "GST recon, ITR computation, statements, notices"),
        ("9", "What you cannot see", "And why — so you are not left guessing"),
        ("★", "Quick reference", "One page to keep next to your desk"),
    ]))

    # ── 1 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        1, "Welcome", "Start here",
        "J-TACS is where your firm keeps its clients, its work and its "
        "deadlines. For you it does three things: it tells you what to do, it "
        "keeps everything about a client in one place, and it records the hours "
        "you spend.",
        f"""
{cards([
    ("It tells you what to do",
     "<p>Work assigned to you appears in <span class='ui'>My Tasks</span> with a "
     "client, a deadline and whatever your manager attached to it. You do not "
     "need to be told separately.</p>"),
    ("Everything about a client is together",
     "<p>Open a client and you get their details, their work, their documents "
     "and their filing history on one screen. No hunting through email.</p>"),
    ("It records your hours",
     "<p>Your time against clients and tasks — which is what your timesheet, "
     "and your firm's billing, are built from.</p>"),
    ("It keeps you out of trouble",
     "<p>Deadlines, checklists and reminders. When work is blocked on a client "
     "you can say so, and it becomes somebody's job to chase them.</p>"),
])}

<h2 class="sec">Your day, in one line</h2>
{flow([("Sign in", ""), ("Accept your tasks", ""), ("Do the work", ""),
       ("Log your time", ""), ("Submit for review", "end-good")])}

{callout("tip", "You cannot break anything",
         "<p>Deleting is reversible, work can move backwards when figures change, "
         "and anything that would genuinely cause a problem is stopped with an "
         "explanation. Click around — that is the fastest way to learn it.</p>")}
""",
    ))

    # ── 2 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        2, "Signing in", "Getting in",
        "Your manager creates your account and the app emails you a temporary "
        "password.",
        f"""
{steps([
    ("Find the email",
     "<p>It has your temporary password in it. If it has not arrived, check your "
     "spam folder, then ask your manager — they can read it off their screen and "
     "give it to you directly.</p>"),
    ("Sign in",
     "<p>Use your <strong>work email address</strong> and that temporary "
     "password.</p>"),
    ("Change the password straight away",
     "<p>Go to <span class='ui'>Settings</span> and set your own. Do not carry on "
     "using the temporary one.</p>"),
    ("If you get locked out",
     "<p><span class='ui'>Forgot password</span> on the sign-in screen emails you "
     "a reset link. You do not need to ask anybody.</p>"),
])}

{callout("warn", "Your screen may be empty at first — this is normal",
         "<p>You see only the clients you have been assigned to and the tasks "
         "given to you. On day one there may be neither. Nothing is broken and "
         "you have not missed a step: ask your manager to assign you a client, "
         "and the screen fills up.</p>")}

{callout("note", "One account, one person",
         "<p>Your account is yours. Everything you do is recorded against your "
         "name — which is how you get credit for your work, so never sign in as "
         "somebody else or let anybody use your login.</p>")}
""",
    ))

    # ── 3 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        3, "Finding your way around", "The layout",
        "The sidebar on the left is your menu. It is grouped, and you can pin "
        "the things you use most to the top.",
        f"""
{navmock([
    ("My Work", [("My Dashboard", True), ("My Tasks", False), ("My Clients", False),
                 ("My Timesheet", False), ("Calendar", False)]),
    ("Workpapers", [("GST Recon", False), ("ITR Computation", False),
                    ("Financial Statements", False), ("Notices", False)]),
    ("Resources", [("Messaging", False)]),
    ("Personal", [("Notifications", False), ("Settings", False)]),
], "This is your whole menu. Managers and Partners see more — that is by design.")}

{table(["Where", "What it is for"], [
    ("My Dashboard", "Your day at a glance: what is due, what is overdue, what is waiting on you."),
    ("My Tasks", "Everything assigned to you. Where you will spend most of your time."),
    ("My Clients", "The clients you have been assigned to."),
    ("My Timesheet", "Your hours."),
    ("Calendar", "Statutory deadlines and your firm's own dates."),
    ("GST Recon, ITR, Statements, Notices", "The working papers for your clients."),
    ("Messaging", "Emails and templates for talking to clients."),
    ("Notifications", "Alerts — a task assigned to you, work sent back, a deadline near."),
    ("Settings", "Your password and your preferences."),
])}

{callout("tip", "Pin your favourites",
         "<p>Hover over any menu item and click the star. It moves to "
         "<span class='ui'>Favourites</span> at the top of the sidebar. The last "
         "three places you visited also appear under <span class='ui'>Recent</span>. "
         "Most people pin <span class='ui'>My Tasks</span> and "
         "<span class='ui'>My Timesheet</span>.</p>")}

<h2 class="sec">Notifications</h2>
<p>The bell tells you when a task is assigned to you, when work you submitted is
sent back, and when a deadline is close. Clicking a notification takes you
straight to the thing it is about, not to a general list.</p>
""",
    ))

    # ── 4 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        4, "Your tasks", "The daily loop",
        "This is the heart of the job. A task is one piece of work for one "
        "client, with a deadline and an owner — you.",
        f"""
<h2 class="sec">Step one: accept it, or decline it</h2>
<p>A new task waits for you to accept it. This is not a formality — until you
accept, your manager does not know it has landed with someone who can do it.</p>

{callout("rule", "If you cannot take it, decline it — do not just leave it",
         "<p>Declining sends it straight back to your manager for reallocation, "
         "with your reason. A task left sitting unaccepted looks handled and is "
         "not, and that is how deadlines get missed.</p>")}

<p>The reasons you can give:</p>
{chips([("No capacity this week", "amber"), ("Not my client", "amber"),
        ("Outside what I do", "amber"), ("Not enough information to start", "amber"),
        ("I'm away when this is due", "amber"), ("Something else", "gray")])}

<h2 class="sec">Step two: work on it</h2>
<p>Open the task. Everything belonging to it is there — the client, the
deadline, the checklist, attachments, and the comments where you and your
manager talk about it. Tick checklist items as you go; your manager can see the
progress without asking you.</p>

<h2 class="sec">Step three: keep the status honest</h2>
{table(["Status", "Use it when"], [
    ("Not started", "It is yours but you have not begun."),
    ("In progress", "You are working on it."),
    ("Data awaited", "<strong>You are stuck waiting for the client.</strong> Use this — see below."),
    ("Under review", "You have finished. This is where you hand it over."),
    ("On hold", "Genuinely paused, for a reason you have noted."),
    ("Filed / Done", "You cannot set this. Your reviewer does."),
])}

{callout("tip", "Data awaited is the most useful status in the app",
         "<p>When you are waiting on the client for a document or a figure, set "
         "it. Your manager gets a list of exactly which clients are holding work "
         "up and chases them. If you leave it at <strong>In progress</strong>, it "
         "looks like <em>you</em> are the delay.</p>")}

<h2 class="sec">Step four: submit it</h2>
{flow([("In progress", ""), ("Under review", ""), ("Your reviewer checks it", ""),
       ("Filed / Done", "end-good")])}

{callout("rule", "You cannot mark your own work Filed / Done",
         "<p>This is not a lack of trust — it is separation of duties, and it "
         "protects you. Somebody else always checks a filing before it goes out. "
         "Move it to <strong>Under review</strong> and a Manager or Partner signs "
         "it off.</p>")}

<h2 class="sec">If it comes back</h2>
<p>Work sent back to you always carries a reason — the app requires one, so you
will never get a silent rejection. You will be notified. Read the reason, fix
it, and submit again.</p>
""",
    ))

    # ── 5 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        5, "Your hours", "Time",
        "Two separate things: the hours the app notices, and the time you record "
        "against work. You should understand both.",
        f"""
<h2 class="sec">How the app counts your presence</h2>
<p>There is no clock-in button. While you have J-TACS open and are working in
it, your browser quietly checks in every few minutes and your minutes add up.</p>

{callout("note", "What this means for you — two things worth knowing",
         "<p><strong>You cannot lose your hours by forgetting to log out.</strong> "
         "If you close your laptop or your session goes quiet, it is closed off "
         "automatically at the last point you were genuinely working. Nothing is "
         "lost.</p>"
         "<p><strong>It only counts while the tab is actually open and "
         "visible.</strong> Leaving J-TACS open in a background tab overnight does "
         "not add hours. It measures presence, not the passage of time.</p>")}

<p>You show as <strong>online</strong> while you are active, and
<strong>idle</strong> after about twenty minutes of nothing. Your manager and
partner can see this — it is how they know who is available, not a way of
watching you.</p>

<h2 class="sec">Your timesheet</h2>
<p><span class="ui">My Timesheet</span> is where you record time against a
client and a task. This is different from presence: presence is when you were
working, your timesheet is <em>what you were working on</em>.</p>

{steps([
    ("Log time against the task, not just the client",
     "<p>It is what lets your firm see how long that kind of work actually "
     "takes.</p>"),
    ("Do it daily",
     "<p>Reconstructing a week on Friday afternoon is guesswork and everybody "
     "knows it.</p>"),
    ("Mark it billable when it is client work",
     "<p>Billable time can be put on the client's invoice. Your firm's billing "
     "depends on it being right.</p>"),
])}

{callout("warn", "Leave and absence",
         "<p>Tell your manager about planned leave so it is recorded in the app. "
         "It is not only about attendance — when leave is recorded, the app warns "
         "your manager if they try to give you a deadline that falls while you "
         "are away. Unrecorded leave means work lands on you anyway.</p>")}
""",
    ))

    # ── 6 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        6, "Your clients", "Client work",
        "<span class='ui'>My Clients</span> shows the clients you have been "
        "assigned to. You will not see anybody else's — that is deliberate, not "
        "a fault.",
        f"""
<h2 class="sec">The client screen</h2>
<p>Open a client and everything about them is under one set of tabs.</p>
{table(["Tab", "What is there"], [
    ("Overview", "Who they are, key dates, contacts."),
    ("Services", "What your firm does for them."),
    ("Tasks", "All the work for this client, including yours."),
    ("Documents", "Their files, and requests you have sent them."),
    ("Compliance", "Their filing calendar and where each period stands."),
    ("Workpapers", "GST reconciliation, ITR computation, statements, notices."),
    ("Activity", "Who did what."),
    ("Timeline", "The client's history as one story."),
])}
{callout("note", "Two tabs you will not see",
         "<p>Managers and Partners also get <strong>Payments</strong> and "
         "<strong>Engagement</strong> tabs. Those carry fees, and fees are not "
         "part of an Employee's view anywhere in the app. Nothing is wrong with "
         "your screen.</p>")}

<h2 class="sec">Talking to clients</h2>
<p><span class="ui">Messaging</span> holds the email templates your firm uses —
reminders, document requests, acknowledgements. Using a template means the
firm's wording goes out rather than yours, which is usually what you want.</p>

{callout("tip", "Log the conversation",
         "<p>If you speak to a client on the phone, put a comment on the task or "
         "a note on the client. The next person to pick it up — possibly you in "
         "three months — will need it.</p>")}
""",
    ))

    # ── 7 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        7, "Documents", "Files",
        "Every document belongs to a client. Putting it in the app rather than "
        "in your email is what makes it findable by anybody who needs it.",
        f"""
{steps([
    ("Upload to the client, not to your desktop",
     "<p>The <span class='ui'>Documents</span> tab on the client. Files are kept "
     "with versions, so replacing one does not destroy the old copy.</p>"),
    ("Request what you need",
     "<p><span class='ui'>Document Requests</span> sends the client a list of "
     "exactly what is outstanding, and shows you what has come back. It beats "
     "another email asking for 'the balance sheet'.</p>"),
    ("Attach working files to the task",
     "<p>Anything specific to a piece of work belongs on the task, so the "
     "reviewer has it in front of them.</p>"),
])}

{callout("tip", "Search finds documents too",
         "<p>The search box at the top searches across clients, tasks and "
         "documents together. It is usually faster than navigating.</p>")}
""",
    ))

    # ── 8 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        8, "Workpapers", "The technical tools",
        "Four purpose-built workbenches for the technical work, each tied to a "
        "client. You can reach them from the sidebar for a list across all your "
        "clients, or from a client's <strong>Workpapers</strong> tab for just "
        "theirs.",
        f"""
{cards([
    ("GST Recon",
     "<p>Reconciles GSTR-2B against the purchase register and shows you the "
     "mismatches, rather than you doing it in a spreadsheet and mailing it "
     "around.</p>"),
    ("ITR Computation",
     "<p>Builds the computation and puts the old and new regimes side by side, so "
     "the comparison is on the record instead of in someone's head.</p>"),
    ("Financial Statements",
     "<p>Produces the P&amp;L and balance sheet from an imported trial "
     "balance.</p>"),
    ("Notices",
     "<p>The register of tax notices and litigation — what arrived, the deadline "
     "to respond, and where it got to.</p>"),
])}

{callout("tip", "Work from the client, not the list",
         "<p>The sidebar entries are indexes across all your clients. When you are "
         "actually doing the work, open the client and use their "
         "<strong>Workpapers</strong> tab — everything is then in the context of "
         "the client it belongs to.</p>")}
""",
    ))

    # ── 9 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        9, "What you cannot see", "Boundaries",
        "So that you are never left wondering whether something is broken. These "
        "are all deliberate.",
        f"""
{table(["You cannot", "Why"], [
    ("See clients you are not assigned to",
     "Your view is your workload. Ask your manager if you need one added."),
    ("See any invoice, payment or fee",
     "Fees are not part of an Employee's view anywhere in the app — not on a "
     "screen, not in search, not on a client's page."),
    ("Mark your own work Filed / Done",
     "Separation of duties. Somebody always checks a filing before it goes out. "
     "It protects you."),
    ("Open Leads, Quotations or Reports",
     "New business and firm-wide reporting sit with Managers and Partners."),
    ("Add or edit team members",
     "Managing people is a Manager's job."),
    ("See the firm-wide compliance overview",
     "You see your own clients' compliance on each client's page."),
])}

{callout("note", "If you need something you cannot reach",
         "<p>Ask your manager. Usually the answer is that a client needs to be "
         "assigned to you, which takes them ten seconds.</p>")}

<h2 class="sec">A good habit to finish on</h2>
<p>At the end of the day: your time is logged, your task statuses reflect
reality, and anything you are waiting on the client for is marked
<strong>Data awaited</strong>. Three things, two minutes. It is what makes the
next morning's list trustworthy — for you and for everybody else.</p>
""",
    ))

    # ── Quick reference ──────────────────────────────────────────────────────
    parts.append(qref(
        T, "Employee quick reference", "Everything important on one page.",
        [
            ("Every day", """<ol style="padding-left:4.5mm;margin:0">
<li>Sign in — hours start counting</li>
<li><strong>Accept</strong> new tasks (or decline with a reason)</li>
<li>Keep statuses honest as you work</li>
<li>Log your time against tasks</li>
<li>Submit finished work as <strong>Under review</strong></li></ol>"""),
            ("Your statuses", """
<div class="qr-kv"><span>Not started</span><span>yours, not begun</span></div>
<div class="qr-kv"><span>In progress</span><span>working on it</span></div>
<div class="qr-kv"><span>Data awaited</span><span>waiting on the client</span></div>
<div class="qr-kv"><span>Under review</span><span>finished, handed over</span></div>
<div class="qr-kv"><span>On hold</span><span>paused, with a note</span></div>
<div class="qr-kv"><span>Filed / Done</span><span>not yours to set</span></div>"""),
            ("Declining a task", """<ul>
<li>No capacity this week</li>
<li>Not my client</li>
<li>Outside what I do</li>
<li>Not enough information to start</li>
<li>I'm away when this is due</li>
<li>Something else</li></ul>
<p style="margin:2mm 0 0;font-size:8.5pt"><strong>Always decline rather than
leaving it sitting.</strong></p>"""),
            ("About your hours", """<ul>
<li>No clock-in button — presence is automatic</li>
<li>Forgetting to log out costs you nothing</li>
<li>Only counts while the tab is actually open</li>
<li>Idle after about 20 minutes of nothing</li>
<li>Your <strong>timesheet</strong> is separate — log what you worked on</li></ul>"""),
            ("Normal, not broken", """<ul>
<li><strong>Empty screen on day one</strong> — no clients assigned yet</li>
<li><strong>No Payments tab</strong> — employees never see fees</li>
<li><strong>Cannot set Filed / Done</strong> — by design</li>
<li><strong>Fewer menu items than your manager</strong> — by design</li></ul>"""),
            ("Ask your manager to", """<ul>
<li>Assign you a client</li>
<li>Reissue your password</li>
<li>Record your planned leave</li>
<li>Reallocate a task you declined</li>
<li>Review work you have submitted</li></ul>"""),
            ("Good habits", """<ul>
<li>Set <strong>Data awaited</strong> the moment you are blocked</li>
<li>Log time daily, not on Friday</li>
<li>Put phone calls in the task comments</li>
<li>Upload documents to the client, not your desktop</li>
<li>Tick checklist items as you go</li></ul>"""),
            ("End of day", """<p style="font-size:9pt;margin:0">Three things, two
minutes:</p><ol style="padding-left:4.5mm;margin:2mm 0 0">
<li>Time logged</li>
<li>Statuses reflect reality</li>
<li>Anything blocked marked <strong>Data awaited</strong></li></ol>"""),
        ],
    ))

    return document(T, "J-TACS Employee Manual", parts)
