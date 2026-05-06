import { randomInt } from 'node:crypto';
import { buildOtpEmail, sendMail } from './_mail.js';
import { applyRateLimit, clearRateLimit, sanitizeEmail, sanitizeOtp } from './_security.js';
import { getPrivilegedSupabase } from './_supabase.js';

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTPS_PER_HOUR = 5;

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function isMissingTableError(error, tableName) {
  const message = `${error?.message || ''}`.toLowerCase();
  return error?.code === '42P01' || message.includes(tableName.toLowerCase());
}

function isMissingColumnError(error, columnName) {
  const message = `${error?.message || ''}`.toLowerCase();
  return error?.code === '42703' || message.includes(columnName.toLowerCase());
}

async function fetchStudentByEmail(supabase, email) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('email', email)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function fetchCourseRecord(supabase, courseId) {
  if (!courseId) return null;

  let { data, error } = await supabase
    .from('courses')
    .select('id, course_name, facilitator_name, facilitator_names, facilitator_title')
    .eq('id', courseId)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'facilitator_names')) {
    ({ data, error } = await supabase
      .from('courses')
      .select('id, course_name, facilitator_name, facilitator_title')
      .eq('id', courseId)
      .maybeSingle());
  }

  if (error) throw error;
  return data || null;
}

async function fetchCourseFacilitators(supabase, courseId) {
  if (!courseId) return [];

  const { data, error } = await supabase
    .from('course_facilitators')
    .select('id, facilitator_name, facilitator_title, sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error && isMissingTableError(error, 'course_facilitators')) {
    return [];
  }

  if (error) throw error;
  return data || [];
}

function buildStudentCourseContext(student = {}, courseRecord = null, facilitators = []) {
  const facilitatorArrayFromCourse = Array.isArray(courseRecord?.facilitator_names)
    ? courseRecord.facilitator_names
        .map((name, index) => ({
          id: null,
          name: `${name || ''}`.trim(),
          title: '',
          sortOrder: index,
        }))
        .filter((facilitator) => facilitator.name)
    : [];

  const normalizedFacilitators = facilitators
    .filter((facilitator) => facilitator?.facilitator_name)
    .map((facilitator) => ({
      id: facilitator.id || null,
      name: facilitator.facilitator_name,
      title: facilitator.facilitator_title || '',
      sortOrder: facilitator.sort_order ?? 0,
    }));

  const effectiveFacilitators =
    normalizedFacilitators.length > 0 ? normalizedFacilitators : facilitatorArrayFromCourse;

  const primaryFacilitator = effectiveFacilitators[0] || null;

  return {
    courseName:
      student.course_name_snapshot || courseRecord?.course_name || student.course || '',
    facilitatorName:
      student.facilitator_name_snapshot ||
      primaryFacilitator?.name ||
      courseRecord?.facilitator_name ||
      '',
    facilitatorTitle:
      student.facilitator_title_snapshot ||
      primaryFacilitator?.title ||
      courseRecord?.facilitator_title ||
      '',
  };
}

async function resolveStudentCourseContext(supabase, student) {
  const [courseRecord, facilitators] = await Promise.all([
    fetchCourseRecord(supabase, student?.course_id),
    fetchCourseFacilitators(supabase, student?.course_id),
  ]);

  return buildStudentCourseContext(student, courseRecord, facilitators);
}

// ---------------------------------------------------------------------------
// Not-found response — returned when the email is not registered.
// ---------------------------------------------------------------------------
function buildNotFoundResponse() {
  return {
    status: 404,
    body: {
      error: 'No record found for that email. Please check and try again.',
    },
  };
}

// ---------------------------------------------------------------------------
// Request OTP
// ---------------------------------------------------------------------------
export async function requestOtpChallenge({ email, ip }) {
  // OWASP A03: Injection — validate & sanitize email before any processing.
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    return {
      status: 400,
      body: { error: 'Please enter a valid email address.' },
    };
  }

  // OWASP A04: Rate limiting by IP
  const ipRateLimit = applyRateLimit(`otp-request:ip:${ip}`, {
    windowMs: 15 * 60 * 1000,
    max: 15,
  });
  if (!ipRateLimit.allowed) {
    return {
      status: 429,
      body: { error: 'Please wait before requesting another verification code.' },
    };
  }

  // Rate limiting by email address
  const inMemoryEmailLimit = applyRateLimit(`otp-request:email:${normalizedEmail}`, {
    windowMs: 10 * 60 * 1000,
    max: 5,
  });
  if (!inMemoryEmailLimit.allowed) {
    return {
      status: 429,
      body: { error: 'Please wait before requesting another verification code.' },
    };
  }

  const supabase = getPrivilegedSupabase();

  // Confirm the email exists in the DB before sending any OTP.
  const student = await fetchStudentByEmail(supabase, normalizedEmail);
  if (!student) {
    return buildNotFoundResponse();
  }

  // Fast-path: already verified with certificate generated
  if (student.otp_verified && student.cert_generated_at) {
    return {
      status: 200,
      body: {
        ok: true,
        alreadyVerified: true,
        student,
      },
    };
  }

  // DB-level rate limit: max OTPs per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentOtpRows, error: recentOtpError } = await supabase
    .from('otp_codes')
    .select('id, created_at')
    .eq('email', normalizedEmail)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(MAX_OTPS_PER_HOUR);

  if (recentOtpError) throw recentOtpError;

  const latestOtp = recentOtpRows?.[0];
  if (latestOtp?.created_at) {
    const latestCreatedAtMs = new Date(latestOtp.created_at).getTime();
    if (
      Number.isFinite(latestCreatedAtMs) &&
      Date.now() - latestCreatedAtMs < RESEND_COOLDOWN_MS
    ) {
      return {
        status: 429,
        body: { error: 'Please wait before requesting another verification code.' },
      };
    }
  }

  if ((recentOtpRows?.length || 0) >= MAX_OTPS_PER_HOUR) {
    return {
      status: 429,
      body: {
        error: 'You have reached the verification code limit. Please try again later.',
      },
    };
  }

  // Generate and persist the OTP code
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('otp_codes').insert({
    email: normalizedEmail,
    code,
    expires_at: expiresAt,
    used: false,
  });
  if (insertError) throw insertError;

  // Attempt to dispatch the email — treat delivery failure as a soft error
  // so the student can use the "Resend" option without re-entering their email.
  let emailDispatched = true;
  let dispatchError = null;

  try {
    await sendMail({
      to: normalizedEmail,
      ...buildOtpEmail({
        toName: student.full_name,
        otpCode: code,
      }),
    });
  } catch (err) {
    emailDispatched = false;
    dispatchError = err;
    console.error('[smtp][otp] Failed to send OTP email:', err?.message || err);
  }

  if (!emailDispatched) {
    // Return a distinct HTTP 500 so the frontend can show a clear error
    // rather than treating it as a masked non-existent address.
    return {
      status: 500,
      body: {
        ok: false,
        emailDispatched: false,
        error:
          'We could not send your verification code right now. ' +
          'Please try the resend option in a moment.',
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      alreadyVerified: false,
      emailDispatched: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Verify OTP
// ---------------------------------------------------------------------------
export async function verifyOtpChallenge({ email, otp, ip }) {
  // OWASP A03: Sanitize inputs
  const normalizedEmail = sanitizeEmail(email);
  const normalizedOtp = sanitizeOtp(otp);

  if (!normalizedEmail) {
    return {
      status: 400,
      body: { error: 'Please enter a valid email address.' },
    };
  }

  if (!normalizedOtp) {
    return {
      status: 400,
      body: { error: 'Invalid or expired code. Please try again.' },
    };
  }

  // OWASP A04: Rate limiting
  const ipRateLimit = applyRateLimit(`otp-verify:ip:${ip}`, {
    windowMs: 10 * 60 * 1000,
    max: 20,
  });
  if (!ipRateLimit.allowed) {
    return {
      status: 429,
      body: { error: 'Too many verification attempts. Please try again later.' },
    };
  }

  const emailRateLimitKey = `otp-verify:email:${normalizedEmail}`;
  const emailRateLimit = applyRateLimit(emailRateLimitKey, {
    windowMs: 10 * 60 * 1000,
    max: 5,
  });
  if (!emailRateLimit.allowed) {
    return {
      status: 429,
      body: { error: 'Too many verification attempts. Please try again later.' },
    };
  }

  const supabase = getPrivilegedSupabase();
  const nowIso = new Date().toISOString();

  const { data: otpRows, error: otpError } = await supabase
    .from('otp_codes')
    .select('id, code, expires_at, used')
    .eq('email', normalizedEmail)
    .eq('code', normalizedOtp)
    .eq('used', false)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  if (otpError) throw otpError;

  const otpRow = otpRows?.[0];
  if (!otpRow) {
    return {
      status: 400,
      body: { error: 'Invalid or expired code. Please try again.' },
    };
  }

  // OWASP A01: Confirm student still exists in DB before granting access
  const student = await fetchStudentByEmail(supabase, normalizedEmail);
  if (!student) {
    return {
      status: 400,
      body: { error: 'Invalid or expired code. Please try again.' },
    };
  }

  const courseContext = await resolveStudentCourseContext(supabase, student);
  const verifiedAt = student.cert_generated_at || nowIso;
  const verifiedUpdate = {
    cert_generated_at: verifiedAt,
    otp_verified: true,
    otp_verified_at: nowIso,
    otp_verified_by_email: normalizedEmail,
    course_name_snapshot:
      courseContext.courseName || student.course_name_snapshot || student.course || '',
    facilitator_name_snapshot:
      courseContext.facilitatorName || student.facilitator_name_snapshot || '',
    facilitator_title_snapshot:
      courseContext.facilitatorTitle || student.facilitator_title_snapshot || '',
  };

  const { error: updateStudentError } = await supabase
    .from('students')
    .update(verifiedUpdate)
    .eq('id', student.id);
  if (updateStudentError) throw updateStudentError;

  const { error: markUsedError } = await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('id', otpRow.id);
  if (markUsedError) throw markUsedError;

  // Clear rate limits on successful verification
  clearRateLimit(emailRateLimitKey);
  clearRateLimit(`otp-verify:ip:${ip}`);

  return {
    status: 200,
    body: {
      ok: true,
      student: {
        ...student,
        ...verifiedUpdate,
      },
    },
  };
}
