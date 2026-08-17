"""Manager manual — for the person who runs the work and the team day to day."""

from manual_kit import (
    ROLE_THEMES, callout, cards, chapter, chips, cover, document, flow,
    navmock, qref, steps, table, toc,
)

T = ROLE_THEMES["manager"]


def build() -> str:
    parts = []

    parts.append(cover(
        T,
        "The Manager's<br>Handbook",
        "You run the work and the people doing it. This covers everything you "
        "can reach in J-TACS, where your authority ends, and how to get a week's "
        "work allocated without anything falling through.",
        ["Your first login", "Clients & onboarding", "Leads & quotations",
         "Allocating work", "Reviewing & signing off", "Your team",
         "Raising invoices", "Reports"],
        "J-TACS · Practice management for Indian CA firms · Manager edition",
    ))

    parts.append(toc([
        ("1", "What being a Manager means", "Your authority, and the four things it stops at"),
        ("2", "Your first login", "Getting in and finding your way around"),
        ("3", "Clients", "Onboarding and the Client 360 screen"),
        ("4", "Leads and quotations", "Running the pipeline from enquiry to engagement"),
        ("5", "Allocating work", "The core of the job — assigning without overloading"),
        ("6", "Reviewing and signing off", "The gate you hold"),
        ("7", "Your team", "Adding people, capacity, attendance, leave"),
        ("8", "Invoices and payments", "What you can raise and what needs a Partner"),
        ("9", "Reports", "Knowing where the week stands"),
        ("★", "Quick reference", "One page to keep next to your desk"),
    ]))

    # ── 1 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        1, "What being a Manager means", "Your remit",
        "A Manager runs the work. In practice that means you can do almost "
        "everything a Partner can, across every client in the firm — with four "
        "clear exceptions.",
        f"""
<h2 class="sec">What you can do</h2>
<ul class="tight">
<li>See and act on <strong>every client</strong> in the firm, not just your own</li>
<li>Create, assign, reassign and reprioritise <strong>any task</strong></li>
<li><strong>Sign off</strong> work that employees submit for review</li>
<li>Onboard clients, run the pipeline, build and send quotations</li>
<li><strong>Raise invoices</strong> and record payments</li>
<li><strong>Add Employees</strong> and issue their logins</li>
<li>See fees, revenue and realisation across the whole book</li>
<li>Run the team: capacity, attendance, leave, performance</li>
</ul>

<h2 class="sec">Where it stops</h2>
{table(["You cannot", "Why", "Who can"], [
    ("Change firm settings, branding or bank details",
     "These print on documents that go to clients and authorities.", "Partner"),
    ("Create another Manager, or remove a Partner",
     "Role escalation is held at the top deliberately.", "Partner"),
    ("Send an invoice over the firm's approval limit",
     "You raise it; it waits for approval before going out.", "Partner"),
    ("Open the audit log or the Payments dashboard",
     "Firm-wide oversight sits with the Partner.", "Partner"),
])}

{callout("note", "You will not be blocked silently",
         "<p>Where you lack authority, J-TACS says so and tells you who to ask. "
         "You will not click something and have nothing happen.</p>")}

<h2 class="sec">What your Employees can and cannot see</h2>
<p>Worth knowing before you assign anything. An Employee sees only the clients
they are assigned to, and <strong>no fees, invoices or payments anywhere</strong>
— not on a screen, not in a search result, not on the client's own page. You can
assign work freely without exposing what the firm charges for it.</p>
{callout("rule", "They also cannot sign off their own work",
         "<p>An Employee finishes a task by moving it to <strong>Under "
         "review</strong>. Only you or a Partner can mark it "
         "<strong>Filed / Done</strong>. That gate is Chapter 6, and it is the "
         "single most important thing you do in this app.</p>")}
""",
    ))

    # ── 2 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        2, "Your first login", "Getting started",
        "Your Partner creates your account and sends you a temporary password. "
        "Here is the first fifteen minutes.",
        f"""
{steps([
    ("Find the invitation email",
     "<p>It contains your temporary password. If it has not arrived, check spam, "
     "then ask your Partner to reissue it — they can read the password off the "
     "screen and give it to you directly.</p>"),
    ("Sign in and change the password",
     "<p>Use your work email and the temporary password. Set your own "
     "immediately. If you are ever locked out, "
     "<span class='ui'>Forgot password</span> emails you a reset link.</p>"),
    ("Look at the dashboard",
     "<p>Work due, work overdue, who is online, and the firm's position. This is "
     "your morning screen.</p>"),
    ("Open Work Tracker and filter to unassigned",
     "<p>The fastest way to see what needs a decision from you today.</p>"),
    ("Pin what you use daily",
     "<p>Hover any sidebar item and click the star. It moves to "
     "<span class='ui'>Favourites</span> at the top. Most Managers pin Work "
     "Tracker, Clients and Employees.</p>"),
])}

<h2 class="sec">Your sidebar</h2>
{navmock([
    ("Quick Actions", [("New Client", False), ("New Task", False),
                       ("New Invoice", False), ("New Quote", False)]),
    ("Operations", [("Dashboard", True), ("Clients", False), ("Work Tracker", False),
                    ("Filings", False), ("Calendar", False), ("Timesheet", False)]),
    ("Workpapers", [("GST Recon", False), ("ITR Computation", False),
                    ("Financial Statements", False), ("Notices", False)]),
    ("Sales / CRM", [("Leads & Quotations", False)]),
    ("Team", [("Employees", False), ("Workforce", False), ("Messaging", False)]),
    ("Finance", [("Invoices", False)]),
    ("Resources", [("Job Templates", False), ("Registers", False), ("Reports", False),
                   ("Revenue", False), ("Fee Realisation", False),
                   ("Notifications", False), ("Settings", False)]),
], "Settings here is your own account. Firm settings are Partner-only.")}

{callout("tip", "Four buttons you will use constantly",
         "<p><span class='ui'>New Client</span>, <span class='ui'>New Task</span>, "
         "<span class='ui'>New Invoice</span> and <span class='ui'>New Quote</span> "
         "sit at the top of the sidebar and open the right dialog straight away.</p>")}
""",
    ))

    # ── 3 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        3, "Clients", "Client management",
        "You can see and act on every client in the firm. Onboarding a new one "
        "is a five-step wizard that sets up their services, checklist and "
        "deadlines at the same time.",
        f"""
<h2 class="sec">Onboarding, step by step</h2>
{steps([
    ("Basic Information",
     "<p>Name, code, entity type, PAN, GSTIN, contacts. PAN and GSTIN are "
     "validated as you type, and a duplicate is caught here — you are offered the "
     "existing client rather than creating a second copy of them.</p>"),
    ("Services Selection",
     "<p>What the firm will do for them: GST, income tax, TDS, audit, ROC, "
     "accounting. Everything downstream depends on this.</p>"),
    ("Service Configuration",
     "<p>The specifics — monthly GST or QRMP, audit liability, fee basis. This is "
     "what makes their deadlines right rather than generic.</p>"),
    ("Document Checklist",
     "<p>What you need from them. Becomes your team's checklist and the client's "
     "portal list.</p>"),
    ("Compliance Setup",
     "<p>Recurring deadlines and reminders. Finish this and their statutory "
     "calendar is already populated.</p>"),
])}
{callout("tip", "Do not stop at step two",
         "<p>A client onboarded with services chosen but no configuration or "
         "compliance setup produces no deadlines and no recurring work. It looks "
         "finished and quietly does nothing.</p>")}

<h2 class="sec">Client status</h2>
{chips([("Active", "green"), ("Pending", "amber"), ("On hold", "violet"), ("Inactive", "gray")])}
<p><strong>Active</strong> clients are included in billing runs and reminders.
<strong>On hold</strong> and <strong>Inactive</strong> are held out of both —
which is exactly why you set them when a client goes quiet or stops paying.</p>

<h2 class="sec">Client 360</h2>
<p>Click a client to get everything about them under one set of tabs:
<strong>Overview</strong>, <strong>Services</strong>, <strong>Tasks</strong>,
<strong>Payments</strong>, <strong>Documents</strong>,
<strong>Compliance</strong>, <strong>Workpapers</strong>,
<strong>Engagement</strong>, <strong>Activity</strong> and
<strong>Timeline</strong>. You see all ten; your Employees see eight — Payments
and Engagement are withheld from them because both carry fees.</p>

<h2 class="sec">Assigning a client team</h2>
<p>On the client, set who is responsible. This is what makes the client appear
in that person's <span class="ui">My Clients</span> — an Employee who has not
been assigned to anybody sees an empty screen, and that is the usual reason a
new joiner reports "there is nothing here".</p>

<h2 class="sec">Groups, documents and requests</h2>
<p><span class="ui">Client Groups</span> ties related entities together — a
family or a group of companies — so you can see and bill them as one.
<span class="ui">Document Requests</span> turns your onboarding checklist into a
list you send the client, and shows you what has come back.</p>
""",
    ))

    # ── 4 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        4, "Leads and quotations", "Pipeline",
        "New business runs through <span class='ui'>Leads &amp; Quotations</span>. "
        "You can do all of it: log the enquiry, build the quote, send it and "
        "convert the win.",
        f"""
<h2 class="sec">Lead stages</h2>
{flow([("New lead", ""), ("Contacted", ""), ("Quotation requested", ""),
       ("Proposal sent", ""), ("Negotiation", ""), ("Won", "end-good")])}
<p>Plus <strong>Follow-up required</strong> and <strong>Client will
revert</strong> for the states real conversations actually sit in, and
<strong>Lost</strong> for the ones that go nowhere. Mark lost leads lost — it
keeps your conversion rate honest.</p>

<h2 class="sec">Building a quotation</h2>
{steps([
    ("Create it from the lead",
     "<p>Line by line, with your services and fees. Saving as you go is safe.</p>"),
    ("Get it approved if your firm requires it",
     "<p>It sits at <strong>Pending approval</strong> until a Partner clears it.</p>"),
    ("Send the link",
     "<p>The client opens it without needing a login, and you can see when they "
     "have viewed it — useful before you chase.</p>"),
    ("They accept or reject",
     "<p>Either way it is recorded, with their reason if they decline.</p>"),
    ("Convert the win",
     "<p>An accepted quotation converts the lead into a client and carries the "
     "agreed services and fees across, dropping you into the onboarding wizard "
     "with the commercial terms already filled in.</p>"),
])}

{callout("rule", "You cannot quietly edit an approved quotation",
         "<p>Changing the numbers on a quotation that has been approved or sent "
         "creates a <strong>revision</strong> and marks the previous one "
         "<em>superseded</em>. Both are kept and the old link stops answering. "
         "This protects you as much as the client — the figure they agreed to is "
         "on the record.</p>")}

<h2 class="sec">Following up</h2>
<p>Quotations carry follow-up dates and the app will remind you. A quote that
expires unanswered is marked <strong>Expired</strong> rather than sitting in the
pipeline forever inflating your numbers.</p>
""",
    ))

    # ── 5 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        5, "Allocating work", "The core of the job",
        "This is what you are for. <span class='ui'>Work Tracker</span> holds "
        "every task in the firm; your job is making sure each one has the right "
        "owner, a real due date, and a person who has actually accepted it.",
        f"""
<h2 class="sec">Creating a task</h2>
<p><span class="ui">New Task</span>, or from the client's Tasks tab. Set the
client, what the work is, the due date, who owns it and — if it needs review —
who reviews it. Applying a <span class="ui">Job Template</span> creates the
whole checklist at once instead of typing the steps again.</p>

<h2 class="sec">What the app checks when you assign</h2>
<p>J-TACS looks at the assignment before saving and tells you what it found.
Two of these stop you; two only warn.</p>
{table(["Finding", "Result", "Why"], [
    ("Their account is disabled", "<strong>Blocked</strong>",
     "The task would sit on somebody who cannot log in and would simply be lost."),
    ("They are the named reviewer", "<strong>Blocked</strong>",
     "Nobody reviews their own work. Caught now rather than at filing."),
    ("On leave when it falls due", "Warning",
     "Assigning ahead to cover leave is normal. A hard stop would just get worked "
     "around by leaving the task unassigned, which is worse."),
    ("Already over capacity", "Warning, with the arithmetic",
     "It shows tasks per working day so you can judge it rather than guess."),
])}

<h2 class="sec">Acceptance — the step people miss</h2>
<p>An assigned task is not yet accepted work. The person accepts it, or declines
it with a reason.</p>
{chips([("No capacity this week", "amber"), ("Not my client", "amber"),
        ("Outside what I do", "amber"), ("Not enough information", "amber"),
        ("Away when it is due", "amber"), ("Something else", "gray")])}
{callout("warn", "A declined task comes back to you",
         "<p>It does not stay on the person who declined it. It returns for "
         "reallocation, and you are told. Check for unaccepted tasks as part of "
         "your morning pass — a task nobody has accepted is a task nobody is "
         "doing.</p>")}

<h2 class="sec">Reassigning in bulk</h2>
<p>When somebody leaves, goes on long leave, or is simply drowning, use
<span class="ui">Reassign work</span> on the Employees page to move everything
they hold to another person in one action, rather than reopening tasks one at
a time.</p>

<h2 class="sec">Statuses and how work moves</h2>
{chips([("Not started", "gray"), ("In progress", "blue"), ("Data awaited", "amber"),
        ("Under review", "violet"), ("Filed / Done", "green"), ("On hold", "gray")])}
<p><strong>Data awaited</strong> is the one to watch. It means the work is
blocked on the client, not on your team — it is a list of phone calls, and it is
the fastest way to unblock a week.</p>
{callout("tip", "Work is allowed to go backwards",
         "<p>Corrected figures arrive; work genuinely reopens. Sending something "
         "back from review or reopening filed work is allowed — it just requires "
         "a reason, so the next person to look knows why.</p>")}

<h2 class="sec">Filings and the calendar</h2>
<p><span class="ui">Filings</span> shows status by client and period — the grid
that answers "is everyone's GSTR-3B done". <span class="ui">Calendar</span> puts
statutory and firm-set dates together so a month can be planned in one place.</p>
""",
    ))

    # ── 6 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        6, "Reviewing and signing off", "The gate you hold",
        "Employees cannot mark their own work filed. It reaches you at "
        "<strong>Under review</strong>, and nothing goes out until you act. This "
        "is the most important thing you do in the app.",
        f"""
{flow([("Employee finishes", ""), ("Under review", ""), ("You check it", ""),
       ("Filed / Done", "end-good")])}
<p>Or, when it is not right:</p>
{flow([("Under review", ""), ("You send it back", ""), ("In progress", "end-bad")])}

{steps([
    ("Find what is waiting",
     "<p>Filter <span class='ui'>Work Tracker</span> to <strong>Under "
     "review</strong>. If you were named as reviewer on a task, you are notified "
     "personally rather than the alert going to every Manager.</p>"),
    ("Check the work",
     "<p>Open the task. Its attachments, comments, checklist and time entries are "
     "all on it. For filings, the acknowledgement details belong on the task — "
     "not in somebody's inbox.</p>"),
    ("Sign it off, or send it back",
     "<p><strong>Filed / Done</strong> closes it. Sending it back to "
     "<strong>In progress</strong> <em>requires a reason</em> — the app will not "
     "let you return work with a silent rejection, because 'check the comments' "
     "with no comment is the oldest complaint about review workflows.</p>"),
    ("Record the filing details",
     "<p>Acknowledgement number, filing date and the financial year the filing "
     "relates to. Note that this is the year of the <em>return</em>, not the year "
     "you filed it — an ITR for FY 2025-26 is filed in July 2026.</p>"),
])}

{callout("rule", "You cannot sign off work you did yourself",
         "<p>If you were the assignee, you cannot also be the one who files it. "
         "Ask another Manager or the Partner. This is separation of duties and it "
         "applies to you too.</p>")}
""",
    ))

    # ── 7 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        7, "Your team", "People",
        "You add Employees, issue their logins, watch their capacity and manage "
        "their leave. You cannot create another Manager — that stays with the "
        "Partner.",
        f"""
<h2 class="sec">Adding someone</h2>
{steps([
    ("Create the record",
     "<p><span class='ui'>Employees</span> → <span class='ui'>Add Employee</span>. "
     "Name, <strong>email</strong>, designation, department, joining date. The "
     "email is not optional — a login cannot be issued without one.</p>"),
    ("Issue the login",
     "<p><span class='ui'>Issue login</span> creates the account, generates a "
     "temporary password and emails it. The screen shows you the password once, "
     "so you can pass it on if the email does not arrive.</p>"),
    ("Assign them clients",
     "<p>Until you do, they log in to an empty screen. This is the single most "
     "common 'the app is broken' report from a new joiner, and it is not a "
     "fault.</p>"),
])}
{callout("note", "Already has a login?",
         "<p>The app will refuse and point you at <span class='ui'>Reset "
         "password</span>. Two accounts for one person splits their work history "
         "in half.</p>")}

<h2 class="sec">Capacity</h2>
<p><span class="ui">Workforce</span> shows who is carrying what. Use it before
you allocate a heavy week rather than after somebody misses a deadline. The
capacity warning when you assign draws on the same numbers.</p>

<h2 class="sec">Attendance and hours</h2>
<p>Hours are counted from presence, not from a clock-in button. While someone
has J-TACS open and is actually working in it, their browser reports in every
few minutes and their minutes accrue.</p>
{callout("note", "What this means in practice",
         "<p>It only counts while the tab is <strong>visible</strong>, so a laptop "
         "left open overnight does not bill the night as work — and nobody loses "
         "their hours by forgetting to log out, because a quiet session is closed "
         "off automatically at the last point they were genuinely there. Somebody "
         "reads as <strong>online</strong> while active, <strong>idle</strong> "
         "after twenty minutes, and is closed off after forty-five.</p>")}
<p>Attendance can be marked <strong>present</strong>, <strong>absent</strong>,
<strong>late</strong>, <strong>half day</strong> or <strong>on leave</strong>,
and exported. Recording leave matters beyond payroll: it is what makes the
"on leave when this falls due" warning appear when you assign work.</p>

<h2 class="sec">When somebody leaves</h2>
<p><span class="ui">Disable</span> stops their login immediately and keeps their
history; it can be undone. Deleting a person is Partner-only. Either way, if
they still hold open tasks the app stops you and tells you how many — reassign
first.</p>
""",
    ))

    # ── 8 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        8, "Invoices and payments", "Billing",
        "You can raise invoices and record payments across every client. Two "
        "things sit above you: the approval limit, and the Payments dashboard.",
        f"""
<h2 class="sec">Raising an invoice</h2>
{steps([
    ("Start it",
     "<p><span class='ui'>New Invoice</span>, or the Payments tab on the client. "
     "Choose the client and the services.</p>"),
    ("Check their GST details first",
     "<p>If the client's GSTIN is missing you are told before the invoice is "
     "raised, not after it has gone out.</p>"),
    ("Pull in unbilled time",
     "<p>Billable time entries for that client can be added to the invoice. Time "
     "logged without a rate cannot become money — if you bill hourly, make sure "
     "rates are set.</p>"),
    ("Send it",
     "<p>It goes as a branded PDF carrying the firm's logo and bank details.</p>"),
])}

<h2 class="sec">The approval limit</h2>
{callout("rule", "Over the limit, it waits",
         "<p>If your Partner has set an approval limit, any invoice you raise "
         "above it is held and marked <em>awaiting approval</em>. It does not go "
         "to the client until a Partner clears it. Under the limit, it goes "
         "straight out. If no limit is set, nothing is ever held.</p>")}

<h2 class="sec">Statuses</h2>
{chips([("Draft", "gray"), ("Sent", "blue"), ("Partially paid", "amber"),
        ("Paid", "green"), ("Overdue", "red"), ("Disputed", "violet"), ("Waived", "gray")])}
<p><strong>Paid</strong> and <strong>Partially paid</strong> cannot be typed —
they come from the receipts you record, so the status can never disagree with
the money. Use <span class="ui">Record Payment</span>. A <strong>Draft</strong>
invoice is never chased as overdue, because the client has never seen it.</p>

<h2 class="sec">Recording a payment</h2>
<p>Enter the amount, date and mode. The invoice status and the outstanding
balance follow automatically. Part payments are normal and handled properly —
the balance is what drives the chasing.</p>

<h2 class="sec">Credit notes</h2>
<p>Issue one against an invoice to reduce it. The app knows the section 34
deadline — 30 November following the financial year of supply — and warns you
when you are past it.</p>
""",
    ))

    # ── 9 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        9, "Reports", "Knowing where you stand",
        "Four reports answer most of what a Manager needs on a Monday morning.",
        f"""
{cards([
    ("Reports", "<p>Workload by person, compliance status across the book, "
     "client profitability. Most export to Excel.</p>"),
    ("Revenue", "<p>Invoice-level ledger with an Excel export.</p>"),
    ("Fee Realisation", "<p>Quoted vs invoiced vs collected, by client and "
     "service. Shows where work quietly failed to turn into money.</p>"),
    ("Workforce", "<p>Capacity, hours, utilisation and attendance for the "
     "team.</p>"),
])}

<h2 class="sec">A workable Monday routine</h2>
{steps([
    ("Dashboard",
     "<p>Overdue work first. Anything red gets dealt with before anything else.</p>"),
    ("Work Tracker, filtered to unaccepted",
     "<p>Tasks nobody has accepted are tasks nobody is doing.</p>"),
    ("Work Tracker, filtered to Data awaited",
     "<p>This is your call list. Each one is a client holding up your team.</p>"),
    ("Filings for the current period",
     "<p>Anything not started with the deadline close gets allocated now.</p>"),
    ("Workforce",
     "<p>Who is at capacity, who has room. Allocate the week accordingly.</p>"),
])}

{callout("tip", "Search across everything",
         "<p>The search box finds clients, tasks, invoices and quotations "
         "together. When results are capped, there is a link to see them all "
         "rather than a silent truncation.</p>")}
""",
    ))

    # ── Quick reference ──────────────────────────────────────────────────────
    parts.append(qref(
        T, "Manager quick reference", "The things you will look up more than once.",
        [
            ("Monday morning", """<ol style="padding-left:4.5mm;margin:0">
<li>Dashboard &rarr; anything overdue</li>
<li>Work Tracker &rarr; unaccepted tasks</li>
<li>Work Tracker &rarr; <strong>Data awaited</strong> = your call list</li>
<li>Filings &rarr; current period gaps</li>
<li>Workforce &rarr; who has room this week</li></ol>"""),
            ("You need a Partner for", """<ul>
<li>Firm settings, branding, bank details</li>
<li>Creating another Manager</li>
<li>Invoices over the approval limit</li>
<li>Deleting a client or a team member</li>
<li>The audit log and Payments dashboard</li></ul>"""),
            ("Assignment checks", """
<div class="qr-kv"><span>Account disabled</span><span>blocked</span></div>
<div class="qr-kv"><span>Is the reviewer</span><span>blocked</span></div>
<div class="qr-kv"><span>On leave at due date</span><span>warning</span></div>
<div class="qr-kv"><span>Over capacity</span><span>warning</span></div>"""),
            ("Task statuses", """
<div class="qr-kv"><span>Not started</span><span>assigned, not begun</span></div>
<div class="qr-kv"><span>In progress</span><span>being worked on</span></div>
<div class="qr-kv"><span>Data awaited</span><span>blocked on client</span></div>
<div class="qr-kv"><span>Under review</span><span>waiting on you</span></div>
<div class="qr-kv"><span>Filed / Done</span><span>you or a Partner</span></div>
<div class="qr-kv"><span>On hold</span><span>deliberately paused</span></div>"""),
            ("Adding an Employee", """<ol style="padding-left:4.5mm;margin:0">
<li>Employees &rarr; Add Employee</li>
<li>A real email address is required</li>
<li>Issue login &rarr; temp password emailed</li>
<li><strong>Assign them clients</strong> — or they see nothing</li></ol>"""),
            ("Reviewing", """<ul>
<li>Filter Work Tracker to <strong>Under review</strong></li>
<li>Sending work back needs a reason</li>
<li>Record acknowledgement no. and filing date</li>
<li>The FY is the return's year, not the filing year</li>
<li>You cannot sign off your own work</li></ul>"""),
            ("Billing rules", """<ul>
<li><strong>Paid</strong> comes from recorded receipts, never typed</li>
<li>Drafts are never chased as overdue</li>
<li>Over the limit &rarr; held for a Partner</li>
<li>Credit notes: 30 Nov after the FY of supply</li>
<li>Check the client's GSTIN before raising</li></ul>"""),
            ("Common questions", """<ul>
<li><strong>New joiner sees nothing</strong> — assign them clients</li>
<li><strong>Task sat untouched</strong> — check it was accepted</li>
<li><strong>Invoice not sent</strong> — may be awaiting approval</li>
<li><strong>No reminders going out</strong> — tell your Partner</li>
<li><strong>Deleted by mistake</strong> — Recycle Bin</li></ul>"""),
        ],
    ))

    return document(T, "J-TACS Manager Manual", parts)
