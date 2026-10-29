import { Request, Response } from "express";

import {
  getGuestSession,
} from "./guest.service";

import {
  addGuestCourse,
  getGuestCourses,
  getOrCreateGuestSemester,
} from "./guest.academic.service";

export async function createGuestSemester(
  req: Request,
  res: Response
) {
  try {
    const sessionToken = req.headers["x-guest-session"];

    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({
        message: "Guest session token is required.",
      });
    }

    const session = await getGuestSession(sessionToken);

    if (!session) {
      return res.status(401).json({
        message: "Guest session is invalid or expired.",
      });
    }

    const {
      curriculumId,
      semesterId,
      attemptNumber,
    } = req.body;

    const semester = await getOrCreateGuestSemester({
      guestSessionId: session.id,
      curriculumId: curriculumId ?? null,
      semesterId: semesterId ?? null,
      attemptNumber: attemptNumber ?? 1,
    });

    return res.status(201).json({
      message: "Guest semester created successfully.",
      semester,
    });
  } catch (error) {
    console.error("Failed to create guest semester:", error);

    return res.status(500).json({
      message: "Failed to create guest semester.",
    });
  }
}

export async function addGuestSemesterCourse(
  req: Request,
  res: Response
) {
  try {
    const sessionToken = req.headers["x-guest-session"];

    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({
        message: "Guest session token is required.",
      });
    }

    const session = await getGuestSession(sessionToken);

    if (!session) {
      return res.status(401).json({
        message: "Guest session is invalid or expired.",
      });
    }

    const {
      guestSemesterId,
      curriculumSubjectId,
      courseCodeSnapshot,
      courseNameSnapshot,
      credits,
      registrationStatus,
      gradeSymbol,
      gradePoint,
      marks,
      maximumMarks,
      resultStatus,
      resultSource,
    } = req.body;

    if (
      !guestSemesterId ||
      !courseCodeSnapshot ||
      !courseNameSnapshot ||
      credits === undefined
    ) {
      return res.status(400).json({
        message: "Required course information is missing.",
      });
    }

    const course = await addGuestCourse({
      guestSemesterId,
      curriculumSubjectId: curriculumSubjectId ?? null,
      courseCodeSnapshot,
      courseNameSnapshot,
      credits: Number(credits),
      registrationStatus,
      gradeSymbol,
      gradePoint:
        gradePoint !== undefined
          ? Number(gradePoint)
          : null,
      marks:
        marks !== undefined
          ? Number(marks)
          : null,
      maximumMarks:
        maximumMarks !== undefined
          ? Number(maximumMarks)
          : null,
      resultStatus,
      resultSource,
    }, session.id);

    if (!course) {
      return res.status(404).json({
        message: "Guest semester not found.",
      });
    }

    return res.status(201).json({
      message: "Guest course saved successfully.",
      course,
    });
  } catch (error) {
    console.error("Failed to save guest course:", error);

    return res.status(500).json({
      message: "Failed to save guest course.",
    });
  }
}

export async function getGuestSemesterCoursesController(
  req: Request,
  res: Response
) {
  try {
    const sessionToken = req.headers["x-guest-session"];

    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({
        message: "Guest session token is required.",
      });
    }

    const session = await getGuestSession(sessionToken);

    if (!session) {
      return res.status(401).json({
        message: "Guest session is invalid or expired.",
      });
    }

    const guestSemesterId =
      typeof req.params.guestSemesterId === "string"
        ? req.params.guestSemesterId
        : "";

    if (!guestSemesterId) {
      return res.status(400).json({
        message: "Guest semester ID is required.",
      });
    }

    const courses = await getGuestCourses(session.id, guestSemesterId);

    if (!courses) {
      return res.status(404).json({
        message: "Guest semester not found.",
      });
    }

    return res.status(200).json({
      courses,
    });
  } catch (error) {
    console.error("Failed to retrieve guest courses:", error);

    return res.status(500).json({
      message: "Failed to retrieve guest courses.",
    });
  }
}
