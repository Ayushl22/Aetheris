async function demoSuccess(data, context) {
    return { ok: true, echo: data, attempt: context.attemptNumber };
}

async function demoFail(data) {
    throw new Error(typeof data.message === "string" ? data.message : "Intentional demo failure");
}

async function demoFlaky(data, context) {
    const failUntilAttempt = Number.isInteger(Number(data.failUntilAttempt)) ? Number(data.failUntilAttempt) : 1;
    if (context.attemptNumber <= failUntilAttempt) {
        throw new Error(`Intentional failure on attempt ${context.attemptNumber}`);
    }
    return { ok: true, recoveredOnAttempt: context.attemptNumber };
}

module.exports = { demoSuccess, demoFail, demoFlaky };
