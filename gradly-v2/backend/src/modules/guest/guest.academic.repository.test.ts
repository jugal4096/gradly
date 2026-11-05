import assert from "node:assert/strict";
import test from "node:test";

type QueryResult = { rows: Array<Record<string, unknown>> };
type QueryFunction = (query: string, values?: unknown[]) => Promise<QueryResult>;

test("guest academic reads and writes are restricted to the verified owning session", async () => {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/gradly_test";
  process.env.FIREBASE_PROJECT_ID = "gradly-test";
  process.env.FIREBASE_CLIENT_EMAIL = "gradly-test@example.invalid";
  process.env.FIREBASE_PRIVATE_KEY = "test-only-key";

  const { pool } = await import("../../config/database");
  const { addGuestCourse, getGuestCourses } = await import("./guest.academic.service");
  const owners = new Map([
    ["semester-a", "guest-a"],
    ["semester-b", "guest-b"],
  ]);
  const savedCourses: Array<Record<string, unknown>> = [];
  const queryable = pool as unknown as { query: QueryFunction };
  const hadOwnQuery = Object.prototype.hasOwnProperty.call(queryable, "query");
  const originalQuery = queryable.query;

  queryable.query = async (query, values = []) => {
    if (query.includes("INSERT INTO guest_semester_courses")) {
      assert.match(query, /semester\.guest_session_id = \$13/);
      const semesterId = String(values[0]);
      const sessionId = String(values[12]);

      if (owners.get(semesterId) !== sessionId) {
        return { rows: [] };
      }

      const row = {
        id: `course-${savedCourses.length + 1}`,
        guest_semester_id: semesterId,
        course_name_snapshot: String(values[3]),
      };
      savedCourses.push(row);
      return { rows: [row] };
    }

    if (query.includes("SELECT id") && query.includes("FROM guest_semesters")) {
      assert.match(query, /guest_session_id = \$2/);
      const semesterId = String(values[0]);
      const sessionId = String(values[1]);

      return owners.get(semesterId) === sessionId
        ? { rows: [{ id: semesterId }] }
        : { rows: [] };
    }

    if (query.includes("FROM guest_semester_courses AS course")) {
      assert.match(query, /semester\.guest_session_id = \$2/);
      const semesterId = String(values[0]);
      const sessionId = String(values[1]);

      if (owners.get(semesterId) !== sessionId) {
        return { rows: [] };
      }

      return {
        rows: savedCourses.filter((course) => course.guest_semester_id === semesterId),
      };
    }

    throw new Error("Unexpected SQL in guest academic ownership test.");
  };

  try {
    const ownCourse = await addGuestCourse({
      guestSemesterId: "semester-a",
      courseCodeSnapshot: "CS101",
      courseNameSnapshot: "Programming",
      credits: 4,
    }, "guest-a");

    assert.ok(ownCourse, "owner should be able to write their course");
    assert.equal(savedCourses.length, 1);

    const crossSessionWrite = await addGuestCourse({
      guestSemesterId: "semester-a",
      courseCodeSnapshot: "CS999",
      courseNameSnapshot: "Unauthorized course",
      credits: 4,
    }, "guest-b");

    assert.equal(crossSessionWrite, null, "another session must not write to this semester");
    assert.equal(savedCourses.length, 1, "unauthorized write must not insert a row");

    const crossSessionRead = await getGuestCourses("guest-b", "semester-a");
    assert.equal(crossSessionRead, null, "another session must not read this semester");

    const ownRead = await getGuestCourses("guest-a", "semester-a");
    assert.equal(ownRead?.length, 1);
    assert.equal(ownRead?.[0]?.course_name_snapshot, "Programming");

    assert.equal(await addGuestCourse({
      guestSemesterId: "semester-a",
      courseCodeSnapshot: "CS999",
      courseNameSnapshot: "No session",
      credits: 4,
    }, ""), null, "missing session identity must fail closed");

    assert.equal(await getGuestCourses("", "semester-a"), null);
    assert.equal(await getGuestCourses("guest-a", ""), null);
  } finally {
    if (hadOwnQuery) {
      queryable.query = originalQuery;
    } else {
      delete (queryable as unknown as Record<string, unknown>).query;
    }
  }
});
