import * as H from 'history'
import { storiesOf } from '@storybook/react'
import { radios, boolean } from '@storybook/addon-knobs'
import React from 'react'
import webStyles from '../../../enterprise.scss'
import { Tooltip } from '../../../components/tooltip/Tooltip'
import { CampaignDetails } from './CampaignDetails'
import { of } from 'rxjs'
import {
    CampaignFields,
    ChangesetExternalState,
    ChangesetPublicationState,
    ChangesetReconcilerState,
    ChangesetCheckState,
    ChangesetReviewState,
} from '../../../graphql-operations'
import {
    fetchCampaignById,
    queryChangesets as _queryChangesets,
    queryExternalChangesetWithFileDiffs,
    queryChangesetCountsOverTime as _queryChangesetCountsOverTime,
} from './backend'
import { subDays } from 'date-fns'
import { NOOP_TELEMETRY_SERVICE } from '../../../../../shared/src/telemetry/telemetryService'
import { useMemo, useCallback } from '@storybook/addons'

let isLightTheme = true
const { add } = storiesOf('web/campaigns/details/CampaignDetails', module).addDecorator(story => {
    const theme = radios('Theme', { Light: 'light', Dark: 'dark' }, 'light')
    document.body.classList.toggle('theme-light', theme === 'light')
    document.body.classList.toggle('theme-dark', theme === 'dark')
    isLightTheme = theme === 'light'
    return (
        <>
            <Tooltip />
            <style>{webStyles}</style>
            <div className="p-3 container web-content">{story()}</div>
        </>
    )
})

const queryChangesets: typeof _queryChangesets = () =>
    of({
        pageInfo: {
            endCursor: null,
            hasNextPage: false,
        },
        totalCount: 6,
        nodes: [
            {
                __typename: 'HiddenExternalChangeset',
                createdAt: subDays(new Date(), 5).toISOString(),
                externalState: ChangesetExternalState.OPEN,
                id: 'someh1',
                nextSyncAt: null,
                publicationState: ChangesetPublicationState.UNPUBLISHED,
                reconcilerState: ChangesetReconcilerState.QUEUED,
                updatedAt: subDays(new Date(), 5).toISOString(),
            },
            {
                __typename: 'HiddenExternalChangeset',
                createdAt: subDays(new Date(), 5).toISOString(),
                externalState: ChangesetExternalState.OPEN,
                id: 'someh2',
                nextSyncAt: null,
                publicationState: ChangesetPublicationState.PUBLISHED,
                reconcilerState: ChangesetReconcilerState.PROCESSING,
                updatedAt: subDays(new Date(), 5).toISOString(),
            },
            {
                __typename: 'HiddenExternalChangeset',
                createdAt: subDays(new Date(), 5).toISOString(),
                externalState: ChangesetExternalState.OPEN,
                id: 'someh3',
                nextSyncAt: null,
                publicationState: ChangesetPublicationState.UNPUBLISHED,
                reconcilerState: ChangesetReconcilerState.ERRORED,
                updatedAt: subDays(new Date(), 5).toISOString(),
            },
            {
                __typename: 'HiddenExternalChangeset',
                createdAt: subDays(new Date(), 5).toISOString(),
                externalState: ChangesetExternalState.OPEN,
                id: 'someh4',
                nextSyncAt: null,
                publicationState: ChangesetPublicationState.PUBLISHED,
                reconcilerState: ChangesetReconcilerState.COMPLETED,
                updatedAt: subDays(new Date(), 5).toISOString(),
            },
            {
                __typename: 'ExternalChangeset',
                body: 'body',
                checkState: ChangesetCheckState.PASSED,
                diffStat: {
                    added: 10,
                    changed: 9,
                    deleted: 1,
                },
                externalID: '123',
                externalURL: {
                    url: 'http://test.test/123',
                },
                labels: [{ color: '93ba13', description: 'Very awesome description', text: 'Some label' }],
                repository: {
                    id: 'repoid',
                    name: 'github.com/sourcegraph/awesome',
                    url: 'http://test.test/awesome',
                },
                reviewState: ChangesetReviewState.COMMENTED,
                title: 'Add prettier to all projects',
                createdAt: subDays(new Date(), 5).toISOString(),
                updatedAt: subDays(new Date(), 5).toISOString(),
                externalState: ChangesetExternalState.OPEN,
                nextSyncAt: null,
                id: 'somev1',
                reconcilerState: ChangesetReconcilerState.COMPLETED,
                publicationState: ChangesetPublicationState.PUBLISHED,
                error: null,
            },
            {
                __typename: 'ExternalChangeset',
                body: 'body',
                checkState: null,
                diffStat: {
                    added: 10,
                    changed: 9,
                    deleted: 1,
                },
                externalID: null,
                externalURL: null,
                labels: [],
                repository: {
                    id: 'repoid',
                    name: 'github.com/sourcegraph/awesome',
                    url: 'http://test.test/awesome',
                },
                reviewState: null,
                title: 'Add prettier to all projects',
                createdAt: subDays(new Date(), 5).toISOString(),
                updatedAt: subDays(new Date(), 5).toISOString(),
                externalState: null,
                nextSyncAt: null,
                id: 'somev2',
                reconcilerState: ChangesetReconcilerState.ERRORED,
                publicationState: ChangesetPublicationState.UNPUBLISHED,
                error: 'Cannot create PR, insufficient token scope.',
            },
        ],
    })

const queryEmptyExternalChangesetWithFileDiffs: typeof queryExternalChangesetWithFileDiffs = () =>
    of({
        diff: {
            __typename: 'PreviewRepositoryComparison',
            fileDiffs: {
                nodes: [],
                totalCount: 0,
                pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                },
            },
        },
    })

const queryChangesetCountsOverTime: typeof _queryChangesetCountsOverTime = () =>
    of([
        {
            date: subDays(new Date(), 5).toISOString(),
            closed: 0,
            merged: 0,
            openPending: 10,
            total: 10,
            openChangesRequested: 0,
            openApproved: 0,
        },
        {
            date: subDays(new Date(), 4).toISOString(),
            closed: 0,
            merged: 0,
            openPending: 7,
            total: 10,
            openChangesRequested: 0,
            openApproved: 3,
        },
        {
            date: subDays(new Date(), 3).toISOString(),
            closed: 0,
            merged: 2,
            openPending: 5,
            total: 10,
            openChangesRequested: 0,
            openApproved: 3,
        },
        {
            date: subDays(new Date(), 2).toISOString(),
            closed: 0,
            merged: 3,
            openPending: 3,
            total: 10,
            openChangesRequested: 1,
            openApproved: 3,
        },
        {
            date: subDays(new Date(), 1).toISOString(),
            closed: 1,
            merged: 5,
            openPending: 2,
            total: 10,
            openChangesRequested: 0,
            openApproved: 2,
        },
        {
            date: new Date().toISOString(),
            closed: 1,
            merged: 5,
            openPending: 0,
            total: 10,
            openChangesRequested: 0,
            openApproved: 4,
        },
    ])

const deleteCampaign = () => Promise.resolve(undefined)

add('Overview', () => {
    const viewerCanAdminister = boolean('viewerCanAdminister', true)
    const isClosed = boolean('isClosed', false)
    const campaign: CampaignFields = useMemo(
        () => ({
            __typename: 'Campaign',
            changesets: {
                stats: {
                    closed: 1,
                    merged: 2,
                    open: 3,
                    total: 10,
                    unpublished: 5,
                },
            },
            createdAt: subDays(new Date(), 5).toISOString(),
            initialApplier: {
                url: '/users/alice',
                username: 'alice',
            },
            diffStat: {
                added: 10,
                changed: 8,
                deleted: 10,
            },
            id: 'specid',
            url: '/users/alice/campaigns/specid',
            namespace: {
                namespaceName: 'alice',
                url: '/users/alice',
            },
            viewerCanAdminister,
            closedAt: isClosed ? subDays(new Date(), 1).toISOString() : null,
            description: '## What this campaign does\n\nTruly awesome things for example.',
            name: 'awesome-campaign',
            updatedAt: subDays(new Date(), 5).toISOString(),
        }),
        [viewerCanAdminister, isClosed]
    )

    const fetchCampaign: typeof fetchCampaignById = useCallback(() => of(campaign), [campaign])
    const history = H.createMemoryHistory({ initialEntries: [window.location.href] })
    return (
        <CampaignDetails
            campaignID="123123"
            fetchCampaignById={fetchCampaign}
            queryChangesets={queryChangesets}
            queryChangesetCountsOverTime={queryChangesetCountsOverTime}
            queryExternalChangesetWithFileDiffs={queryEmptyExternalChangesetWithFileDiffs}
            deleteCampaign={deleteCampaign}
            history={history}
            location={history.location}
            isLightTheme={isLightTheme}
            telemetryService={NOOP_TELEMETRY_SERVICE}
            platformContext={{} as any}
            extensionsController={{} as any}
        />
    )
})
