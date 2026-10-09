import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import {
  makeContinuityList,
  makeConsultationBrief,
} from '@/specialist-continuity/specialist-continuity-test-fixtures'
import { createSpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import { createSpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'
import {
  makeSessionSummary,
  makeSessionSummaryList,
} from '@/specialist-summary/specialist-summary-test-fixtures'

import { createSpecialistAppointmentApi } from './specialist-appointment-api'
import {
  makeAppointment,
  makeAppointmentList,
} from './specialist-appointment-test-fixtures'

function response(request: InternalAxiosRequestConfig, data: unknown) {
  return {
    config: request,
    data,
    headers: {},
    status: 200,
    statusText: 'OK',
  }
}

describe('MB-634 public mobile contract clients', () => {
  it('loads the assigned specialist appointment collection', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(request, makeAppointmentList())
    }
    const api = createSpecialistAppointmentApi(create({ adapter }))

    await expect(api.listAssigned()).resolves.toEqual(makeAppointmentList())
    expect(requests[0]?.url).toBe('/api/v1/specialist/appointments')
  })

  it('rejects an appointment response that silently drifts from the contract', async () => {
    const adapter: AxiosAdapter = async (request) =>
      response(request, {
        ...makeAppointmentList(),
        mobileOwnedAuthority: true,
      })
    const api = createSpecialistAppointmentApi(create({ adapter }))

    await expect(api.listAssigned()).rejects.toThrow()
  })

  it.each(['accept', 'reject'] as const)(
    'sends %s with the exact version and caller command key',
    async (decision) => {
      const requests: InternalAxiosRequestConfig[] = []
      const appointment = makeAppointment({ version: 7 })
      const adapter: AxiosAdapter = async (request) => {
        requests.push(request)
        return response(
          request,
          makeAppointment({
            status: decision === 'accept' ? 'CONFIRMED' : 'REJECTED',
            version: 8,
          }),
        )
      }
      const api = createSpecialistAppointmentApi(create({ adapter }))

      await api.decide(
        appointment,
        decision,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      )

      expect(requests[0]?.url).toBe(
        `/api/v1/specialist/appointments/${appointment.id}/${decision}`,
      )
      expect(requests[0]?.headers.get('If-Match')).toBe('"7"')
      expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      )
    },
  )

  it('uses only the approved Care continuity and brief endpoints', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(
        request,
        requests.length === 1 ? makeContinuityList() : makeConsultationBrief(),
      )
    }
    const api = createSpecialistContinuityApi(create({ adapter }))
    const appointmentId = makeAppointment().id

    await api.list()
    await api.getBrief(appointmentId)

    expect(requests.map((request) => request.url)).toEqual([
      '/api/v1/specialist/client-continuity',
      `/api/v1/specialist/consultation-briefs/${appointmentId}`,
    ])
  })

  it('lists and publishes the exact summary version through Consultation', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(
        request,
        requests.length === 1
          ? makeSessionSummaryList()
          : makeSessionSummary({ version: 2 }),
      )
    }
    const api = createSpecialistSummaryApi(create({ adapter }))
    const appointmentId = makeAppointment().id
    const body = {
      topicsDiscussed: ['Nhịp ngủ'],
      progressSummary: null,
      specialistNoteForUser: null,
      followUpSuggested: false,
      agreedNextSteps: [],
    }

    await api.list(appointmentId)
    await api.publish(
      appointmentId,
      body,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      1,
    )

    expect(requests[0]?.url).toBe(
      `/api/v1/specialist/appointments/${appointmentId}/session-summaries`,
    )
    expect(requests[1]?.headers.get('If-Match')).toBe('"1"')
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    )
    expect(JSON.parse(String(requests[1]?.data))).toEqual(body)
  })

  it('omits If-Match only for the first summary publication', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(request, makeSessionSummary())
    }
    const api = createSpecialistSummaryApi(create({ adapter }))

    await api.publish(
      makeAppointment().id,
      {
        topicsDiscussed: ['Nhịp ngủ'],
        progressSummary: null,
        specialistNoteForUser: null,
        followUpSuggested: false,
        agreedNextSteps: [],
      },
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      undefined,
    )

    expect(requests[0]?.headers.get('If-Match')).toBeUndefined()
  })
})
