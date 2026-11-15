# Departing member handoff

Use this procedure when someone leaves a team or needs their account deactivated. Team removal ends the access granted by membership. Existing assignee and support fields stay on tasks so managers can identify and hand off work. Any independent global administrator access follows the account's global role.

## Remove access to one team

1. In **Team → Members**, check the departing person's role. If they own the team, transfer ownership to a current member. A super admin can transfer ownership if the owner is unavailable. The successor becomes Owner, and the former owner becomes Team Admin until the successor removes them.
2. In each editable project, including Completed and On Hold projects, open **List**. Use **Assignee** to find the person's primary assignments. Clear that filter and search by the person's first or last name to find support work too. Check the **Assignee** and **Support** columns to confirm identity, especially when names overlap. Use **Status** to focus on To Do, In Progress, In Review, and On Hold, and review all result pages.
3. Open each affected task and choose a current member as assignee or support. Clear optional support if the task no longer needs it. Leave completed and cancelled work as history.
4. Remove the person from **Members** and verify they disappear from the team directory. If access needs to end immediately, remove the membership as soon as ownership is handled and finish reassignment afterward. The project Assignee filter can still find a former member's assignments while they remain on visible tasks.

Team owners can remove team admins or regular members. Team admins can remove regular members. [Team governance rules](permissions.md)

## Archive a whole account

1. An authorized global admin opens **Users → Archive user** and reviews the person's roles, team memberships, and **Open work**. Transfer ownership of every active team they own. Ask the relevant team owners or admins to reassign open work in their teams. Archive promptly once ownership is handled if sign-in needs to stop before the handoff finishes.
2. Confirm the archive. The account's active sessions end, and sign-in is blocked. Memberships and history are retained. When a membership should end permanently, remove it through the team workflow.
3. If restoring an account later, review the displayed global role and remaining memberships, then confirm Restore. The user signs in again to regain access allowed by those roles.

## Verification

The PostgreSQL integration tests exercise owner transfer, removal while open work remains, loss of team task access, finding retained assignee and support work, and reassignment by the successor. The account lifecycle tests exercise sign-in and session revocation on archive and access review before restoration.
