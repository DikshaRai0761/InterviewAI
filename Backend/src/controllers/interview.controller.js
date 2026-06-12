const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")


/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {

    try {

        console.log("===== REQUEST RECEIVED =====")
        console.log("FILE =>", req.file)
        console.log("BODY =>", req.body)

        const { selfDescription, jobDescription } = req.body

        // Resume ya Self Description me se ek required hai
        if (!req.file && !selfDescription?.trim()) {
            return res.status(400).json({
                message: "Either Resume or Self Description is required"
            })
        }

        let resumeText = ""

        // Resume upload hua hai to parse karo
        if (req.file) {

            const resumeContent = await (
                new pdfParse.PDFParse(
                    Uint8Array.from(req.file.buffer)
                )
            ).getText()

            resumeText = resumeContent.text

            console.log("PDF Parsed Successfully")
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription
        })

        console.log("AI RESPONSE =>", interViewReportByAi)

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })

    } catch (err) {

        console.error("========= ERROR OCCURRED =========")
        console.error(err)

        return res.status(500).json({
            message: err.message
        })
    }
}


/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({
        _id: interviewId,
        user: req.user.id
    })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/**
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {

    const interviewReports = await interviewReportModel
        .find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {

    try {

        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findById(interviewReportId)

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const { resume, jobDescription, selfDescription } = interviewReport

        const pdfBuffer = await generateResumePdf({
            resume,
            jobDescription,
            selfDescription
        })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)

    } catch (err) {

        console.error("PDF ERROR =>", err)

        if (err.status === 503) {
            return res.status(503).json({
                message: "AI service is busy. Please try again after some time."
            })
        }

        return res.status(500).json({
            message: err.message
        })
    }
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
}