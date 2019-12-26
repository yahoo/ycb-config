
module.exports = [
    {
        settings: [ 'device:mobile' ],
        selector: 'mobile'
    },
    {
        settings: {
            dimensions: ["device:mobile"],
            schedule: {
                end: "2010-11-29T00:04:00Z"
            }
        },
        name: 'old'
    },
    {
        settings: {
            dimensions: ["device:mobile"],
            schedule: {
                start: "2010-11-29T00:04:00Z"
            }
        },
        name: 'new'
    }
];
