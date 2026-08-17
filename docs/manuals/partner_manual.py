"""Partner manual — the full product, for the person who owns the firm."""

from manual_kit import (
    ROLE_THEMES, callout, cards, chapter, chips, cover, document, flow,
    navmock, qref, steps, table, toc,
)

T = ROLE_THEMES["partner"]


def build() -> str:
    parts = []

    parts.append(cover(
        T,
        "The Partner's<br>Handbook",
        "Everything J-TACS does, from the first login to the day your practice "
        "runs on it. Read it once end to end — after that it is a reference.",
        ["Setting up your firm", "Roles & permissions", "Client onboarding",
         "Leads & quotations", "Work allocation", "Billing & approvals",
         "Team oversight", "Statutory registers"],
        "J-TACS · Practice management for Indian CA firms · Partner edition",
    ))

    parts.append(toc([
        ("1", "The shape of the app", "How J-TACS is laid out and why"),
        ("2", "Day one: your firm exists", "Sign up, first login, what to do in the first hour"),
        ("3", "Setting up the firm", "Identity, branding, approval limits, email, schedules"),
        ("4", "Who sees what", "The four roles and the exact line between them"),
        ("5", "Building your team", "Adding people, issuing logins, leavers"),
        ("6", "Bringing clients in", "The onboarding wizard and the Client 360 screen"),
        ("7", "Leads, quotations, clients", "The pipeline from enquiry to engagement"),
        ("8", "Getting work done", "Tasks, filings, reviews and templates"),
        ("9", "Money", "Invoices, approvals, payments and what you can see"),
        ("10", "Watching the firm", "Performance, attendance, reports, audit trail"),
        ("11", "Registers and safekeeping", "Credentials, DSC, UDIN, the recycle bin"),
        ("★", "Quick reference", "One page to keep next to your desk"),
    ]))

    # ── 1 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        1, "The shape of the app", "Orientation",
        "Before any buttons: J-TACS is one workspace for your firm. Everything "
        "in it belongs to your firm and nobody outside it can see a single row. "
        "Inside, what a person sees depends on their role.",
        f"""
{cards([
    ("One firm, one workspace",
     "<p>Signing up creates your firm. Every client, task, invoice and document "
     "is stamped with it. Another firm using J-TACS cannot see your data even if "
     "you both act for the same company.</p>"),
    ("Four kinds of people",
     "<p><strong>Partner</strong> runs the firm. <strong>Manager</strong> runs the "
     "work. <strong>Employee</strong> does the work. <strong>Client</strong> gets a "
     "read-only portal. You are the Partner.</p>"),
    ("The sidebar is role-aware",
     "<p>You see roughly twenty-five destinations. A Manager sees fewer, an "
     "Employee about a dozen. Nobody is shown a door they cannot open.</p>"),
    ("Clients are the spine",
     "<p>Almost everything hangs off a client — tasks, filings, invoices, "
     "documents, workpapers. The <span class='ui'>Client 360</span> screen gathers "
     "all of it in one place.</p>"),
])}

<h2 class="sec">How work flows through the firm</h2>
<p>Read left to right. This is the whole product in one line, and the rest of
this manual simply expands each box.</p>
{flow([("Lead", ""), ("Quotation", ""), ("Client", ""), ("Tasks", ""),
       ("Review", ""), ("Filed", ""), ("Invoice", ""), ("Paid", "end-good")])}

<h2 class="sec">Your sidebar</h2>
<p>Grouped, collapsible, and yours to rearrange. Hover any item and click the
star to pin it to <span class="ui">Favourites</span> at the top. The three
places you have been most recently appear under <span class="ui">Recent</span>.</p>
{navmock([
    ("Quick Actions", [("New Client", False), ("New Task", False),
                       ("New Invoice", False), ("New Quote", False)]),
    ("Operations", [("Dashboard", True), ("Clients", False), ("Work Tracker", False),
                    ("Filings", False), ("GST Recon", False), ("ITR Computation", False),
                    ("Notices", False), ("Financial Statements", False),
                    ("Calendar", False), ("Timesheet", False), ("Client Groups", False)]),
    ("Sales / CRM", [("Leads & Quotations", False)]),
    ("Finance", [("Payments", False), ("Invoices", False)]),
    ("People", [("Employees", False), ("Performance", False)]),
    ("Communication", [("Messaging", False)]),
    ("Management", [("Reports", False), ("Revenue", False), ("Fee Realisation", False),
                    ("Audit Logs", False), ("Job Templates", False), ("Registers", False),
                    ("Notifications", False), ("Recycle Bin", False), ("Settings", False)]),
], "Only the Partner sees all seven groups. Audit Logs is Partner-only.")}

{callout("tip", "Collapse the sidebar",
         "<p>Click the rail on its edge to shrink it to icons and win back screen "
         "width. Your favourites and groups stay exactly as you left them.</p>")}
""",
    ))

    # ── 2 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        2, "Day one: your firm exists", "Getting started",
        "Signing up creates the firm and makes you its founding Partner. There "
        "is a fourteen-day trial and no card is asked for. Here is the first hour.",
        f"""
{steps([
    ("Sign up",
     "<p>Go to the sign-up page and enter your name, your firm's name, your email "
     "and a password. That single act creates the workspace and makes you the "
     "founding Partner. There is no separate 'create firm' step afterwards.</p>"),
    ("Confirm your email and sign in",
     "<p>Use the same email address at <span class='ui'>Sign in</span>. If you "
     "ever forget the password, <span class='ui'>Forgot password</span> on the "
     "login screen sends a reset link — you never need anyone's help for this.</p>"),
    ("Land on an empty dashboard",
     "<p>It will be empty, and that is correct. Every count is zero because you "
     "have no clients yet. Nothing is broken.</p>"),
    ("Fill in the firm's details",
     "<p>Go to <span class='ui'>Settings</span> and complete your firm identity "
     "before anything else. Invoices, engagement letters and client emails all "
     "draw on it, so doing it now saves reissuing documents later. Chapter 3 "
     "walks through every field.</p>"),
    ("Add your first person, or your first client",
     "<p>Either order works. Most firms add two or three team members first so "
     "that work can be assigned the moment clients arrive.</p>"),
])}

{callout("rule", "You are the only Partner until you say otherwise",
         "<p>Nobody else can grant the Partner or Manager role. When you add "
         "team members they become Employees unless you deliberately choose "
         "otherwise — and only you can make somebody a Manager.</p>")}

<h2 class="sec">What to expect on the dashboard</h2>
<p>Once the firm has data, the dashboard is your standing view of it: work due,
work overdue, who is online, money outstanding and the month's numbers. Until
then it shows empty states that tell you what would appear there.</p>
""",
    ))

    # ── 3 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        3, "Setting up the firm", "Settings",
        "Ten minutes here decides how the product behaves for everybody else. "
        "Open <span class='ui'>Settings</span> from the sidebar.",
        f"""
<h2 class="sec">Firm identity</h2>
<p>Your firm's name, address, PAN, GSTIN and ICAI firm registration number.
These print on invoices, quotations and engagement letters. Get the FRN right —
it appears on documents that go to clients and to authorities.</p>

<h2 class="sec">Branding</h2>
<p>Upload your logo. It appears on the invoices and quotations your clients
receive, and in the client portal. A logo is the difference between a document
that looks like it came from your firm and one that looks like it came from
software.</p>

<h2 class="sec">Bank details</h2>
<p>Account name, number, IFSC and UPI. These print on every invoice so clients
know where to pay. An invoice without them generates a phone call.</p>

<h2 class="sec">The invoice approval limit</h2>
<p>This is the most consequential setting on the page, and the one most often
left blank. Set an amount, and any invoice a <strong>Manager</strong> raises
above it is held for your approval before it can go out.</p>
{table(["Who raises it", "Amount", "What happens"], [
    ("Partner", "Any", "Goes out immediately. You are never gated."),
    ("Manager", "At or under the limit", "Goes out immediately."),
    ("Manager", "Over the limit", "Held, marked <em>awaiting approval</em>, and waits for a Partner."),
    ("Anyone", "Limit left blank", "Nothing is ever held. Every invoice goes straight out."),
])}
{callout("warn", "A blank limit means no approvals at all",
         "<p>If you leave the field empty, Managers can raise an invoice of any "
         "size without you seeing it first. That may be exactly what you want in "
         "a small firm — just decide it deliberately rather than by default.</p>")}

<h2 class="sec">Email</h2>
<p>J-TACS sends staff invitations, client reminders and portal invites by
email. Until email is configured, none of those arrive and the failure is
quiet. Your administrator sets this up once during installation; the
<span class="path">/docs/email-setup</span> page inside the app has the steps.
Send yourself a test before you rely on it.</p>

<h2 class="sec">Scheduled jobs</h2>
<p>Several things happen without anyone clicking: deadline reminders go out,
retainer invoices are raised, overdue invoices are flagged, attendance is
closed off at the end of the day, and stale work is escalated. These run on a
schedule configured at installation.</p>
{callout("note", "Worth confirming once",
         "<p>Ask whoever installed J-TACS to confirm the scheduled jobs are "
         "running. If they are not, everything still works when a person clicks "
         "it — but nothing happens on its own, and the silence looks identical "
         "to 'nothing was due'.</p>")}
""",
    ))

    # ── 4 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        4, "Who sees what", "Roles and permissions",
        "Choosing somebody's role is the highest-consequence decision in the "
        "app: it decides whether they can see every client's fees. Here is the "
        "exact line.",
        f"""
{table(["Role", "In one line", "What it grants", "Where it stops"], [
    ("Partner", "Runs the firm.",
     "Firm settings and branding · approving and waiving invoices · adding and "
     "removing Managers · deleting clients and staff · the audit trail",
     "Nothing. You see everything."),
    ("Manager", "Runs the work.",
     "Every client, task, invoice and quotation in the firm · adding Employees "
     "and assigning their work · raising invoices and recording payments",
     "Cannot change firm settings · cannot create another Manager or remove a "
     "Partner · invoices over the limit still need you"),
    ("Employee", "Does the work.",
     "Their own tasks, deadlines and timesheet · only the clients they are "
     "assigned to",
     "Cannot see anyone else's clients · <strong>no access to invoices, "
     "payments or fees at all</strong> · cannot sign off their own filings"),
    ("Client", "Your customer.",
     "A read-only portal: their documents, their filing status, their invoices",
     "Sees only their own record, and only what you publish to them"),
], big=True)}

<h2 class="sec">The same thing, screen by screen</h2>
{table(["Screen", "Partner", "Manager", "Employee"], [
    ("Dashboard, Clients, Work Tracker, Calendar, Timesheet, Messaging", "Yes", "Yes", "Yes"),
    ("GST Recon, ITR Computation, Notices, Financial Statements", "Yes", "Yes", "Yes — own clients"),
    ("Filings (compliance overview)", "Yes", "Yes", "No"),
    ("Invoices", "Yes", "Yes", "No"),
    ("Payments dashboard", "Yes", "No", "No"),
    ("Leads &amp; Quotations", "Yes", "Yes", "No"),
    ("Employees, Reports, Job Templates, Registers, Client Groups, Recycle Bin", "Yes", "Yes", "No"),
    ("Performance / Workforce", "Yes", "Yes", "No"),
    ("Audit Logs", "Yes", "No", "No"),
])}

{callout("rule", "Employees and money",
         "<p>An Employee cannot reach invoices, payments or fees anywhere in the "
         "product — not through a screen, not through a search result, not on the "
         "client's own page. The billing tabs are not merely hidden from them; "
         "the data is never sent. You can assign work freely without exposing "
         "what you charge for it.</p>")}

{callout("tip", "Deciding between Manager and Employee",
         "<p>Ask one question: <em>should this person see every client's fees?</em> "
         "If yes, Manager. If no, Employee. Everything else follows from that.</p>")}
""",
    ))

    # ── 5 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        5, "Building your team", "People",
        "Adding someone happens in two stages: you create their record, then you "
        "issue them a login. Keeping those separate lets you set up an entire "
        "team before anybody can sign in.",
        f"""
{steps([
    ("Open Employees and add the person",
     "<p>Go to <span class='ui'>Employees</span> → <span class='ui'>Add "
     "Employee</span>. Name, email, designation, department, joining date. "
     "<strong>The email matters</strong> — a login cannot be issued without one, "
     "and it is where their invitation goes.</p>"),
    ("Choose their role",
     "<p>The role picker explains what each role grants and where it stops, right "
     "in the dialog. Only you can choose <strong>Manager</strong>; a Manager "
     "adding staff can only create Employees.</p>"),
    ("Issue the login",
     "<p>On the employee's row, choose <span class='ui'>Issue login</span>. "
     "J-TACS creates the account, generates a temporary password and emails it "
     "to them. The screen also shows you the password once, in case the email "
     "does not arrive.</p>"),
    ("They sign in and change it",
     "<p>They use their email and the temporary password, then set their own. "
     "From that moment they see the app through their role.</p>"),
    ("Assign them clients and work",
     "<p>An Employee sees nothing until they are assigned to a client or given a "
     "task. A brand-new Employee with an empty screen is not a fault — they have "
     "not been given anything yet.</p>"),
])}

{callout("warn", "One login per person",
         "<p>If someone already has a login, <span class='ui'>Issue login</span> "
         "will refuse and tell you to use <span class='ui'>Reset password</span> "
         "instead. That is deliberate: two accounts for one person split their "
         "work history in half.</p>")}

<h2 class="sec">Importing a team in one go</h2>
<p>If you are moving from spreadsheets, <span class="ui">Import</span> on the
Employees page takes a CSV. The dialog shows the exact column format with a
worked example. Import first, issue logins afterwards.</p>

<h2 class="sec">When somebody leaves</h2>
<p>There are two different actions and they are not interchangeable.</p>
{table(["Action", "What it does", "Use it when"], [
    ("Disable", "Their login stops working immediately. Their record, history and "
     "completed work all stay. They can be re-enabled.",
     "Somebody has left, is on long leave, or you need to cut access today."),
    ("Delete", "Removes the person from the active roster. Partner only.",
     "A record created in error, or a genuine cleanup."),
])}
{callout("stop", "Open work is checked before either",
         "<p>If the person still has open tasks, J-TACS stops and tells you how "
         "many, rather than quietly stranding the work where nobody will look "
         "for it. Reassign first — the <span class='ui'>Reassign work</span> "
         "action moves everything to another team member in one step — then "
         "disable or delete.</p>")}
""",
    ))

    # ── 6 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        6, "Bringing clients in", "Onboarding",
        "Client onboarding is a five-step wizard rather than a form. Each step "
        "builds something the firm uses later, so finishing it properly means "
        "the work, the checklist and the deadlines already exist on day one.",
        f"""
<h2 class="sec">The five steps</h2>
{steps([
    ("Basic Information",
     "<p>Name, client code, type of entity, PAN, GSTIN, contact details. "
     "PAN and GSTIN are checked as you type — a GSTIN with a bad checksum is "
     "caught here rather than at filing time. If the PAN or GSTIN already "
     "belongs to another client, you are sent back to this step and offered the "
     "existing record instead of creating a duplicate.</p>"),
    ("Services Selection",
     "<p>Tick what you will do for them: GST, income tax, TDS, audit, ROC, "
     "accounting, and so on. This decides everything downstream.</p>"),
    ("Service Configuration",
     "<p>For each service, the specifics — GST filing frequency (monthly or "
     "QRMP), whether they are audit-liable, the fee basis. This is what makes "
     "deadlines correct for <em>this</em> client rather than generic.</p>"),
    ("Document Checklist",
     "<p>What you need from them. It becomes the checklist your team works "
     "against and the list the client sees in their portal.</p>"),
    ("Compliance Setup",
     "<p>The recurring deadlines and reminders. Finish this and the client's "
     "statutory calendar is already populated — nobody has to remember to set "
     "up GSTR-3B every month.</p>"),
])}

{callout("tip", "The wizard will not let you skip ahead",
         "<p>A later step stays locked until the ones before it are valid. It is "
         "not being awkward: a document checklist with no services chosen has "
         "nothing to list.</p>")}

<h2 class="sec">Client status, and what it means</h2>
{chips([("Active", "green"), ("Pending", "amber"), ("On hold", "violet"), ("Inactive", "gray")])}
<p>These are not decoration. <strong>Active</strong> clients appear in work
allocation and billing runs. <strong>On hold</strong> and
<strong>Inactive</strong> clients are held out of automatic billing and
reminders — which is the point of setting them.</p>

<h2 class="sec">The Client 360 screen</h2>
<p>Click any client and you get everything about them under one set of tabs.
This is where you and your Managers will spend most of your time.</p>
{table(["Tab", "What lives there"], [
    ("Overview", "The summary, key dates, and portal access for the client"),
    ("Services", "What you do for them and on what terms"),
    ("Tasks", "Every piece of work, open and closed"),
    ("Payments", "Invoices, receipts and outstanding balance — <em>Partner and Manager only</em>"),
    ("Documents", "Everything filed against them, plus document requests"),
    ("Compliance", "Their filing calendar and status by period"),
    ("Workpapers", "GST reconciliation, ITR computation, financial statements, notices"),
    ("Engagement", "Engagement letter, terms and fee — <em>Partner and Manager only</em>"),
    ("Activity", "Who did what on this client"),
    ("Timeline", "The client's history as a single narrative"),
])}

<h2 class="sec">Bulk import and groups</h2>
<p><span class="ui">Import</span> on the Clients page takes a CSV for moving an
existing book across. <span class="ui">Client Groups</span> ties related
entities together — a family, or a group of companies — so you can see and bill
them as one.</p>

{callout("note", "Clients with no email",
         "<p>A client with no email address cannot be sent reminders, invoices or "
         "a portal invitation, and the app will tell you so rather than silently "
         "skipping them. If a client genuinely has no email, that is fine — just "
         "know their reminders will need a phone call.</p>")}
""",
    ))

    # ── 7 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        7, "Leads, quotations, clients", "Sales pipeline",
        "Every client starts as somebody who called. <span class='ui'>Leads &amp; "
        "Quotations</span> is where that conversation lives until it becomes an "
        "engagement — or does not.",
        f"""
<h2 class="sec">The lead pipeline</h2>
{flow([("New lead", ""), ("Contacted", ""), ("Quotation requested", ""),
       ("Proposal sent", ""), ("Negotiation", ""), ("Won", "end-good")])}
<p>Two more stages sit alongside these for the situations that actually happen:
<strong>Follow-up required</strong> and <strong>Client will revert</strong>.
A lead that goes nowhere is marked <strong>Lost</strong> — which keeps it in
your conversion numbers instead of vanishing.</p>

<h2 class="sec">Quotations</h2>
<p>Build a quotation from a lead, line by line. It gets a public link you can
send; you can see when the client has viewed it, and they can accept or reject
it without needing a login.</p>
{flow([("Draft", ""), ("Pending approval", ""), ("Approved", ""), ("Sent", ""),
       ("Viewed", ""), ("Accepted", "end-good")])}
{table(["Status", "Meaning"], [
    ("Draft", "Being written. Not visible to anyone outside the firm."),
    ("Pending approval", "Waiting on a Partner, if your firm requires it."),
    ("Approved", "Cleared internally, ready to send."),
    ("Sent", "The client has the link."),
    ("Viewed", "They have opened it. Useful before you chase."),
    ("Accepted", "They said yes. Convert the lead to a client."),
    ("Rejected", "They said no — with their reason recorded."),
    ("Expired", "Its validity date passed without an answer."),
    ("Superseded", "Replaced by a revision. Kept for the audit trail; the old link no longer answers."),
])}

{callout("rule", "An approved quotation cannot be quietly edited",
         "<p>Once a quotation has been approved or sent, changing the numbers "
         "creates a <strong>revision</strong> and marks the old one "
         "<em>superseded</em>. Both are kept. This is what stops a figure the "
         "client agreed to from being altered afterwards with no record.</p>")}

<h2 class="sec">Turning a won lead into a client</h2>
<p>Accepting a quotation converts the lead into a client and carries the agreed
services and fees across, so you are not retyping the deal you just closed. You
land in the onboarding wizard from Chapter 6 with the commercial terms already
filled in.</p>

<h2 class="sec">Knowing what your pipeline is worth</h2>
<p><span class="ui">Fee Realisation</span> under Management compares what you
quoted, what you actually invoiced and what you collected — by client and by
service. It is the report that shows where quoted work quietly failed to turn
into money.</p>
""",
    ))

    # ── 8 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        8, "Getting work done", "Work and filings",
        "<span class='ui'>Work Tracker</span> is the firm's task list. Every "
        "piece of work belongs to a client, has an owner and a due date, and "
        "moves through a small set of statuses everybody understands.",
        f"""
<h2 class="sec">The six statuses</h2>
{chips([("Not started", "gray"), ("In progress", "blue"), ("Data awaited", "amber"),
        ("Under review", "violet"), ("Filed / Done", "green"), ("On hold", "gray")])}
{table(["Status", "What it actually means"], [
    ("Not started", "Assigned, not yet begun."),
    ("In progress", "Someone is working on it now."),
    ("Data awaited", "Blocked on the client. This is the one that tells you to pick up the phone."),
    ("Under review", "Finished by the doer, waiting for a reviewer. Employees end here."),
    ("Filed / Done", "Signed off. Only a Manager or Partner can set this."),
    ("On hold", "Deliberately paused."),
])}

{callout("rule", "Nobody signs off their own filing",
         "<p>An Employee cannot mark work <strong>Filed / Done</strong>. They "
         "submit it as <strong>Under review</strong> and a Manager or Partner "
         "signs it off. This is separation of duties, enforced by the app rather "
         "than by memory.</p>")}

<h2 class="sec">Assigning work</h2>
<p>When you assign a task, J-TACS checks the assignment before it saves and
tells you what it found.</p>
{table(["What it finds", "What happens"], [
    ("The person's account is disabled", "<strong>Blocked.</strong> The work would simply be lost."),
    ("They are the named reviewer for this task", "<strong>Blocked.</strong> They cannot review their own work."),
    ("They are on leave when it falls due", "Warning. Assigning ahead to cover leave is normal, so it does not stop you."),
    ("They already have more than they can do", "Warning, with the arithmetic shown — tasks per working day."),
])}

<h2 class="sec">Accepting and declining</h2>
<p>An assigned task waits for the person to accept it. If they cannot take it,
they decline <strong>with a reason</strong> — no capacity, not my client,
outside what I do, not enough information, away when it is due, or something
else — and it comes back to you rather than sitting on their list untouched.</p>

<h2 class="sec">Job templates</h2>
<p><span class="ui">Job Templates</span> under Management turns a recurring
engagement into a reusable checklist. Define your GST monthly filing or a
statutory audit once, with its steps and typical durations, and apply it to any
client instead of rebuilding it each time.</p>

<h2 class="sec">Filings and the calendar</h2>
<p><span class="ui">Filings</span> shows filing status by client and period —
the grid you use to answer "is everyone's GSTR-3B done". <span class="ui">
Calendar</span> puts statutory dates and your firm's own dates in one place,
because nobody plans a month across two calendars.</p>

{callout("tip", "Work can move backwards",
         "<p>Corrected figures arrive and work genuinely goes back a stage. "
         "J-TACS allows it — sending something back from review, or reopening "
         "filed work, just requires a reason. A practice is not a one-way "
         "conveyor belt, and an app that pretends otherwise gets worked "
         "around.</p>")}
""",
    ))

    # ── 9 ────────────────────────────────────────────────────────────────────
    parts.append(chapter(
        9, "Money", "Billing",
        "Invoices, receipts and the reports that tell you whether the work you "
        "did turned into money. Employees see none of this.",
        f"""
<h2 class="sec">Raising an invoice</h2>
{steps([
    ("Start it",
     "<p><span class='ui'>New Invoice</span> from the sidebar, or the Payments "
     "tab on a client. Pick the client and the services.</p>"),
    ("Check the client's GST details",
     "<p>If the client's GSTIN is missing, you are told before the invoice is "
     "raised rather than after it has gone out. A tax invoice without a GSTIN is "
     "a reissue waiting to happen.</p>"),
    ("Bill the time, if you track it",
     "<p>Unbilled time entries for that client can be pulled onto the invoice. "
     "Time recorded against a rate becomes money here; time recorded without one "
     "is just a number.</p>"),
    ("Send it",
     "<p>It goes out as a branded PDF with your logo and bank details. There is a "
     "print view for everything a client might reasonably want on paper.</p>"),
])}

<h2 class="sec">Invoice statuses</h2>
{chips([("Draft", "gray"), ("Sent", "blue"), ("Partially paid", "amber"),
        ("Paid", "green"), ("Overdue", "red"), ("Disputed", "violet"), ("Waived", "gray")])}
{callout("note", "Paid is earned, not typed",
         "<p><strong>Paid</strong> and <strong>Partially paid</strong> cannot be "
         "set by hand. They are derived from the payments you actually record, so "
         "the status and the receipts can never disagree. Use "
         "<span class='ui'>Record Payment</span>.</p>")}
<p>A <strong>Draft</strong> invoice is never treated as overdue — it has not
been sent to anybody. Only invoices that have genuinely been issued and still
have a balance are chased.</p>

<h2 class="sec">Approvals — your gate</h2>
<p>If you set an approval limit in Chapter 3, invoices raised by a Manager above
it appear in your approvals queue. Nothing goes to the client until you clear
it. You can also <strong>waive</strong> an invoice, which is recorded as a
deliberate decision rather than a deletion.</p>

<h2 class="sec">Credit notes</h2>
<p>Issue a credit note against an invoice when you need to reduce it. J-TACS
knows the section 34 deadline — a credit note affecting GST liability must be
issued by 30 November following the financial year of supply — and will tell
you when you are past it.</p>

<h2 class="sec">The three money reports</h2>
{cards([
    ("Payments", "<p>Partner-only. The overall position: what is outstanding, "
     "what is ageing, who owes you.</p>"),
    ("Revenue", "<p>Invoice-level ledger with an Excel export. The one to hand "
     "your accountant.</p>"),
    ("Fee Realisation", "<p>Quoted vs invoiced vs collected, by client and by "
     "service. Where the leakage is.</p>"),
    ("Reports", "<p>Everything else — workload, compliance status, client "
     "profitability — with exports.</p>"),
])}
""",
    ))

    # ── 10 ───────────────────────────────────────────────────────────────────
    parts.append(chapter(
        10, "Watching the firm", "Oversight",
        "Four screens answer the questions a Partner actually asks: who is "
        "working, how much, on what, and who changed that.",
        f"""
<h2 class="sec">Performance</h2>
<p><span class="ui">Performance</span> under People shows the team: who is
online now, hours worked, tasks completed, utilisation and capacity. Click into
any individual for their own view.</p>

<h2 class="sec">How hours are counted</h2>
<p>Worth understanding, because people will ask you.</p>
{callout("note", "The app counts presence, not the clock",
         "<p>While someone is working with J-TACS open, their browser quietly "
         "reports in every few minutes. Minutes accrue from those check-ins. "
         "<strong>It only counts while the tab is actually visible</strong> — so a "
         "laptop left open overnight does not bill the night as work, and nobody "
         "has to remember to clock out. If a session goes quiet it is closed off "
         "automatically at the last point the person was genuinely there.</p>")}
<p>Someone reads as <strong>online</strong> while they are active, drops to
<strong>idle</strong> after twenty minutes of nothing, and their session is
closed off after forty-five. Attendance can also be marked
<strong>present</strong>, <strong>absent</strong>, <strong>late</strong>,
<strong>half day</strong> or <strong>on leave</strong>, and exported.</p>

<h2 class="sec">Timesheets</h2>
<p><span class="ui">Timesheet</span> is where hours are recorded against
clients and tasks. Time marked billable and carrying a rate can be pulled onto
an invoice. Time with no rate is measurement, not money — if you intend to bill
by the hour, make sure rates are set.</p>

<h2 class="sec">Reports</h2>
<p>Workload by person, compliance status across the book, client profitability,
revenue and realisation. Most export to Excel.</p>

<h2 class="sec">Audit logs</h2>
<p><span class="ui">Audit Logs</span> is <strong>Partner only</strong>. Every
consequential action — who changed a fee, who deleted a client, who approved an
invoice, who signed off a filing — with who and when. Neither Managers nor
Employees can see it, which is what makes it worth having.</p>

{callout("tip", "The one screen to check weekly",
         "<p>Performance, on a Monday. Overdue work and people at capacity show up "
         "there before they show up as an angry client.</p>")}
""",
    ))

    # ── 11 ───────────────────────────────────────────────────────────────────
    parts.append(chapter(
        11, "Registers and safekeeping", "Records",
        "The statutory records a practice must keep, and the safety net for when "
        "something is deleted by mistake.",
        f"""
<h2 class="sec">Registers</h2>
{cards([
    ("Credentials vault",
     "<p>Government portal logins — GST, income tax, MCA, TRACES — encrypted at "
     "rest. This is what stops portal passwords living in a shared spreadsheet.</p>"),
    ("DSC register",
     "<p>Digital signature certificates: whose, which authority, expiry. An "
     "expired DSC discovered on a filing deadline is a bad day.</p>"),
    ("UDIN register",
     "<p>UDINs generated, against which client and which engagement — linked to "
     "the work rather than kept in a separate list.</p>"),
    ("Statutory registrations",
     "<p>Each client's registrations and their renewal dates.</p>"),
])}

{callout("stop", "Guard the vault key",
         "<p>The credentials vault is encrypted with a key held in your "
         "installation's configuration. If that key is ever changed or lost, "
         "<strong>every stored credential becomes permanently unreadable</strong>. "
         "Make sure whoever administers your installation has it backed up "
         "somewhere safe.</p>")}

<h2 class="sec">The recycle bin</h2>
<p>Deleting a client, invoice or task does not destroy it — it goes to
<span class="ui">Recycle Bin</span>, where a Partner or Manager can restore it.
Records are retained in line with SQC 1's seven-year expectation, so deleting
something is a reversible mistake rather than a permanent one.</p>

<h2 class="sec">Documents</h2>
<p>Documents are stored per client with versions and an activity trail.
<span class="ui">Document Requests</span> lets you ask a client for a specific
list and see what has arrived — the checklist you built during onboarding
becomes the request you send.</p>

<h2 class="sec">Getting help inside the app</h2>
<p>The help centre in the app covers the common questions and links to setup
guides. It is quicker than this manual for a single question.</p>
""",
    ))

    # ── Quick reference ──────────────────────────────────────────────────────
    parts.append(qref(
        T, "Partner quick reference", "The things you will look up more than once.",
        [
            ("First hour", """<ul>
<li>Sign up &rarr; you are the founding Partner</li>
<li><strong>Settings</strong> &rarr; firm identity, logo, bank details</li>
<li><strong>Settings</strong> &rarr; set the invoice approval limit</li>
<li>Confirm email sending works — test it</li>
<li>Add two or three team members</li>
<li>Onboard your first client</li></ul>"""),
            ("Only a Partner can", """<ul>
<li>Change firm settings and branding</li>
<li>Create a Manager</li>
<li>Approve or waive an invoice over the limit</li>
<li>Delete a client or a team member</li>
<li>See the audit log</li>
<li>Open the Payments dashboard</li></ul>"""),
            ("Task statuses", """
<div class="qr-kv"><span>Not started</span><span>assigned, not begun</span></div>
<div class="qr-kv"><span>In progress</span><span>being worked on</span></div>
<div class="qr-kv"><span>Data awaited</span><span>blocked on the client</span></div>
<div class="qr-kv"><span>Under review</span><span>waiting for sign-off</span></div>
<div class="qr-kv"><span>Filed / Done</span><span>Manager or Partner only</span></div>
<div class="qr-kv"><span>On hold</span><span>deliberately paused</span></div>"""),
            ("Lead pipeline", """
<div class="qr-kv"><span>New lead</span><span>just arrived</span></div>
<div class="qr-kv"><span>Contacted</span><span>spoken to</span></div>
<div class="qr-kv"><span>Quotation requested</span><span>they want a price</span></div>
<div class="qr-kv"><span>Proposal sent</span><span>quote is with them</span></div>
<div class="qr-kv"><span>Negotiation</span><span>discussing terms</span></div>
<div class="qr-kv"><span>Won / Lost</span><span>closed either way</span></div>"""),
            ("Adding a person", """<ol style="padding-left:4.5mm;margin:0">
<li>Employees &rarr; Add Employee</li>
<li>Enter a real email — required for login</li>
<li>Choose the role (only you can pick Manager)</li>
<li>Issue login &rarr; temp password is emailed</li>
<li>Assign them clients or tasks</li></ol>"""),
            ("Before removing a person", """<ul>
<li>Check their open tasks</li>
<li>Use <strong>Reassign work</strong> to move it all at once</li>
<li>Then <strong>Disable</strong> (reversible) or <strong>Delete</strong></li>
<li>Disable keeps history; use it for leavers</li></ul>"""),
            ("Money rules", """<ul>
<li><strong>Paid</strong> comes from recorded receipts, never typed</li>
<li>A <strong>Draft</strong> invoice is never chased as overdue</li>
<li>Blank approval limit = no approvals at all</li>
<li>Credit notes: 30 Nov after the FY of supply</li>
<li>Employees see no fees, anywhere</li></ul>"""),
            ("If something looks wrong", """<ul>
<li><strong>No emails arriving</strong> — email config; test from Settings</li>
<li><strong>No reminders at all</strong> — scheduled jobs may not be running</li>
<li><strong>Employee sees nothing</strong> — they have no clients assigned</li>
<li><strong>Deleted by mistake</strong> — Recycle Bin</li>
<li><strong>Who changed this?</strong> — Audit Logs</li></ul>"""),
        ],
    ))

    return document(T, "J-TACS Partner Manual", parts)
