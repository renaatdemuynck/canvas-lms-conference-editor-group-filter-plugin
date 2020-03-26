import { addReadyListener } from './util';

import styles from './index.module.css';


export default function ({ router, api }) {
    router.addListener('courses.conferences', params => {
        let groupsMap, sectionsMap;
        let firstRun = true;

        addReadyListener('#members_list', membersList => {

            // Do some initialization on the first run
            if (firstRun) {
                firstRun = false;

                // Wait for all data to be fetched
                Promise.all([
                    api.get(`/courses/${params.courseId}/users`, {
                        per_page: 100,
                        enrollment_type: 'student',
                        include_inactive: false,
                        include: ['enrollments', 'group_ids']
                    }),
                    api.get(`/courses/${params.courseId}/groups`),
                    api.get(`/courses/${params.courseId}/sections`)
                ]).then(([users, groups, sections]) => {
                    let userMapper = user => `user_${user.id}`;
                    let groupMapper = group => ([`group_${group.id}`, {
                        name: group.name,
                        members: users.filter(user => user.group_ids.includes(group.id)).map(userMapper)
                    }]);
                    let sectionMapper = section => ([`section_${section.id}`, {
                        name: section.name,
                        members: users.filter(user => user.enrollments.some(enrollment => enrollment.course_section_id === section.id)).map(userMapper)
                    }]);

                    // Get the group subscriptions
                    groupsMap = new Map(groups.map(groupMapper));
                    // Get the section subscriptions
                    sectionsMap = new Map(sections.map(sectionMapper));

                    main();
                });
            } else {
                main();
            }

            let legend = membersList.closest('form').querySelector('legend');
            let inviteAllUsers = document.getElementById('user_all');
            let removeObservers = document.getElementById('observers_remove');
            let checkboxes = membersList.querySelectorAll('.member input[type="checkbox"][id^="user_"]');

            // Insert a new 'Members' control group after the last one
            legend.insertAdjacentHTML('beforebegin', `
                <div class="control-group">
                    <label class="control-label">${legend.textContent}</label>
                    <div class="controls">
                        <div id="${styles.membersSelector}">
                            <button id="${styles.selectAll}" class="btn">Select all</button>
                            <select id="${styles.groupFilter}">
                                <option>No group filter selected</option>
                            </select>
                        </div>
                    </div>
                </div>
            `);

            let membersControlGroup = legend.previousElementSibling;
            let membersSelector = document.getElementById(styles.membersSelector);
            let groupFilter = document.getElementById(styles.groupFilter);
            let selectAll = document.getElementById(styles.selectAll);

            // Move the relevant controls to the new control group
            membersSelector.parentNode.prepend(inviteAllUsers.previousElementSibling);
            membersSelector.parentNode.append(removeObservers.parentNode);
            groupFilter.parentNode.append(membersList);

            // Remove the remaining unwanted nodes
            while (membersControlGroup.nextSibling !== null) {
                membersControlGroup.nextSibling.remove();
            }

            function main() {
                groupFilter.insertAdjacentHTML('beforeend', `
                    <optgroup label="Group">
                        ${Array.from(groupsMap.entries()).map(([key, group]) => `<option value="${key}">${group.name}</option>`).join('\n')}
                    </optgroup>
                    <optgroup label="Course section">
                        ${Array.from(sectionsMap.entries()).map(([key, section]) => `<option value="${key}">${section.name}</option>`).join('\n')}
                    </optgroup>
                `);

                // Filter the users on selection change
                groupFilter.addEventListener('change', event => {
                    let match = event.target.value.match(/^(section|group)_\d+$/);

                    if (match === null) {
                        checkboxes.forEach(checkbox => {
                            checkbox.closest('li').removeAttribute('hidden');
                        });

                        return;
                    }

                    let [key, type] = match;
                    let map = (type === 'group') ? groupsMap : sectionsMap;
                    let members = map.get(key).members;

                    checkboxes.forEach(checkbox => {
                        checkbox.closest('li').toggleAttribute('hidden', !members.includes(checkbox.id));
                    });
                });

                selectAll.addEventListener('click', event => {
                    let checkboxes = membersList.querySelectorAll('.member:not([hidden]) input[type="checkbox"][id^="user_"]');

                    event.preventDefault();

                    checkboxes.forEach(checkbox => {
                        checkbox.checked = true;
                    });
                });
            }

        });

    });
}
