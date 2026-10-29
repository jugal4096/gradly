import { Router } from "express";

import {
  authenticateSuperAdminToken,
} from "../../middleware/super-admin-auth.middleware";

import {
  getAdministrators,
  getAdministratorDetails,
  updateAdministratorStatus,
  updateAdministratorDepartment,
  extendAdminship,
  updateGraduationDate,
  getAdministratorActivity,
  getAdministratorPermissions,
  updateAdministratorPermissions,
  sendAdministratorNotice,
} from "./administrator.controller";

const router = Router();

/*
 * EVERYTHING IN THIS ROUTER IS
 * SUPER ADMIN ONLY.
 */

router.use(
  authenticateSuperAdminToken
);

/* =========================================================
   ADMINISTRATOR LIST
   ========================================================= */

/*
GET /api/super-admin/administrators

Optional query params:

?institutionId=
&branchId=
&status=
&registrationStatus=
&search=
*/

router.get(
  "/",
  getAdministrators
);

/* =========================================================
   ADMINISTRATOR DETAILS
   ========================================================= */

router.get("/:adminId/activity", getAdministratorActivity);
router.get("/:adminId/permissions", getAdministratorPermissions);
router.put("/:adminId/permissions", updateAdministratorPermissions);
router.post("/:adminId/notices", sendAdministratorNotice);

router.get(
  "/:adminId",
  getAdministratorDetails
);

/* =========================================================
   CHANGE STATUS
   ========================================================= */

router.patch(
  "/:adminId/status",
  updateAdministratorStatus
);

/* =========================================================
   CHANGE DEPARTMENT
   ========================================================= */

router.patch(
  "/:adminId/department",
  updateAdministratorDepartment
);

/* =========================================================
   EXTEND ADMINSHIP
   ========================================================= */

router.patch(
  "/:adminId/adminship",
  extendAdminship
);

/* =========================================================
   CHANGE GRADUATION DATE
   ========================================================= */

router.patch(
  "/:adminId/graduation-date",
  updateGraduationDate
);

export default router;