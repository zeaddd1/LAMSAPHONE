import { StepResponse, WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { GenerateInput, runGeneration } from "../lib/quick-add/ai-jobs"

// quick-add-generate: يحسّن صور المهمة ويولّد النصوص ويحدّث الحالات.
// يُشغَّل في الخلفية (بدون انتظار) من مسارات /admin/quick-add/jobs، فلا تتعلق الواجهة.
// لا يحفظ شيئاً في المتجر ولا ينشر: ذلك فقط بعد "اعتماد".
const generateStep = createStep("quick-add-generate-step", async (input: GenerateInput, { container }) => {
  await runGeneration(container, input)
  return new StepResponse({ job_id: input.job_id })
})

export const quickAddGenerateWorkflow = createWorkflow("quick-add-generate", (input: GenerateInput) => {
  const r = generateStep(input)
  return new WorkflowResponse(r)
})

export default quickAddGenerateWorkflow
