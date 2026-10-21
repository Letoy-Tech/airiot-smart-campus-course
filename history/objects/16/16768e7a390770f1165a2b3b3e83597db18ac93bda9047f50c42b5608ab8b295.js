export const mockCampus = {
  "source": "TEACHING_MOCK",
  "simulated": true,
  "observedAt": 1792454400000,
  "spaces": [
    {
      "id": "s1",
      "name": "101教室",
      "building": "教学楼",
      "floor": "1"
    },
    {
      "id": "s2",
      "name": "201教室",
      "building": "教学楼",
      "floor": "2"
    },
    {
      "id": "s3",
      "name": "101实验室",
      "building": "实验楼",
      "floor": "1"
    },
    {
      "id": "s4",
      "name": "201实验室",
      "building": "实验楼",
      "floor": "2"
    }
  ],
  "devices": [
    {
      "id": "d01",
      "name": "温湿度01",
      "category": "environment",
      "spaceId": "s1",
      "online": true,
      "simulated": true
    },
    {
      "id": "d02",
      "name": "温湿度02",
      "category": "environment",
      "spaceId": "s2",
      "online": true,
      "simulated": true
    },
    {
      "id": "d03",
      "name": "温湿度03",
      "category": "environment",
      "spaceId": "s3",
      "online": null,
      "simulated": true
    },
    {
      "id": "d04",
      "name": "温湿度04",
      "category": "environment",
      "spaceId": "s4",
      "online": false,
      "simulated": true
    },
    {
      "id": "d05",
      "name": "电表01",
      "category": "energy",
      "spaceId": "s1",
      "online": true,
      "simulated": true
    },
    {
      "id": "d06",
      "name": "电表02",
      "category": "energy",
      "spaceId": "s2",
      "online": true,
      "simulated": true
    },
    {
      "id": "d07",
      "name": "电表03",
      "category": "energy",
      "spaceId": "s3",
      "online": true,
      "simulated": true
    },
    {
      "id": "d08",
      "name": "电表04",
      "category": "energy",
      "spaceId": "s4",
      "online": true,
      "simulated": true
    },
    {
      "id": "d09",
      "name": "设施01",
      "category": "facility",
      "spaceId": "s1",
      "online": true,
      "simulated": true
    },
    {
      "id": "d10",
      "name": "设施02",
      "category": "facility",
      "spaceId": "s2",
      "online": true,
      "simulated": true
    },
    {
      "id": "d11",
      "name": "设施03",
      "category": "facility",
      "spaceId": "s3",
      "online": true,
      "simulated": true
    },
    {
      "id": "d12",
      "name": "设施04",
      "category": "facility",
      "spaceId": "s4",
      "online": true,
      "simulated": true
    },
    {
      "id": "d13",
      "name": "灯光01",
      "category": "lighting",
      "spaceId": "s1",
      "online": true,
      "simulated": true
    },
    {
      "id": "d14",
      "name": "灯光02",
      "category": "lighting",
      "spaceId": "s2",
      "online": true,
      "simulated": true
    },
    {
      "id": "d15",
      "name": "灯光03",
      "category": "lighting",
      "spaceId": "s3",
      "online": true,
      "simulated": true
    },
    {
      "id": "d16",
      "name": "灯光04",
      "category": "lighting",
      "spaceId": "s4",
      "online": true,
      "simulated": true
    }
  ],
  "points": [
    {
      "deviceId": "d01",
      "tagId": "temperature",
      "value": 24.0,
      "unit": "°C",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d01",
      "tagId": "humidity",
      "value": 61.0,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d02",
      "tagId": "temperature",
      "value": 24.2,
      "unit": "°C",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d02",
      "tagId": "humidity",
      "value": 61.2,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d03",
      "tagId": "temperature",
      "value": null,
      "unit": "°C",
      "time": null,
      "quality": "missing"
    },
    {
      "deviceId": "d03",
      "tagId": "humidity",
      "value": 61.4,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d04",
      "tagId": "temperature",
      "value": 24.6,
      "unit": "°C",
      "time": 1792454400000,
      "quality": "stale"
    },
    {
      "deviceId": "d04",
      "tagId": "humidity",
      "value": 61.6,
      "unit": "%",
      "time": 1792454400000,
      "quality": "stale"
    },
    {
      "deviceId": "d05",
      "tagId": "power",
      "value": 0,
      "unit": "kW",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d05",
      "tagId": "voltage",
      "value": 220.0,
      "unit": "V",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d06",
      "tagId": "power",
      "value": 1.6,
      "unit": "kW",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d06",
      "tagId": "voltage",
      "value": 220.2,
      "unit": "V",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d07",
      "tagId": "power",
      "value": 1.8,
      "unit": "kW",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d07",
      "tagId": "voltage",
      "value": 220.4,
      "unit": "V",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d08",
      "tagId": "power",
      "value": 2.0,
      "unit": "kW",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d08",
      "tagId": "voltage",
      "value": 220.6,
      "unit": "V",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d09",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d10",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d11",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d12",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d13",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d13",
      "tagId": "brightness",
      "value": 75.0,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d14",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d14",
      "tagId": "brightness",
      "value": 75.2,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d15",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d15",
      "tagId": "brightness",
      "value": 75.4,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d16",
      "tagId": "status",
      "value": 1,
      "unit": "",
      "time": 1792454400000,
      "quality": "fresh"
    },
    {
      "deviceId": "d16",
      "tagId": "brightness",
      "value": 75.6,
      "unit": "%",
      "time": 1792454400000,
      "quality": "fresh"
    }
  ],
  "history": [
    {
      "deviceId": "d01",
      "tagId": "temperature",
      "unit": "°C",
      "samples": [
        {
          "time": 1792452900000,
          "value": 24.0
        },
        {
          "time": 1792453200000,
          "value": 24.0
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 24.0
        },
        {
          "time": 1792454400000,
          "value": 24.0
        }
      ]
    },
    {
      "deviceId": "d01",
      "tagId": "humidity",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 61.0
        },
        {
          "time": 1792453200000,
          "value": 61.0
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 61.0
        },
        {
          "time": 1792454400000,
          "value": 61.0
        }
      ]
    },
    {
      "deviceId": "d02",
      "tagId": "temperature",
      "unit": "°C",
      "samples": [
        {
          "time": 1792452900000,
          "value": 24.2
        },
        {
          "time": 1792453200000,
          "value": 24.2
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 24.2
        },
        {
          "time": 1792454400000,
          "value": 24.2
        }
      ]
    },
    {
      "deviceId": "d02",
      "tagId": "humidity",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 61.2
        },
        {
          "time": 1792453200000,
          "value": 61.2
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 61.2
        },
        {
          "time": 1792454400000,
          "value": 61.2
        }
      ]
    },
    {
      "deviceId": "d03",
      "tagId": "temperature",
      "unit": "°C",
      "samples": [
        {
          "time": 1792452900000,
          "value": 24.4
        },
        {
          "time": 1792453200000,
          "value": 24.4
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 24.4
        },
        {
          "time": 1792454400000,
          "value": 24.4
        }
      ]
    },
    {
      "deviceId": "d03",
      "tagId": "humidity",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 61.4
        },
        {
          "time": 1792453200000,
          "value": 61.4
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 61.4
        },
        {
          "time": 1792454400000,
          "value": 61.4
        }
      ]
    },
    {
      "deviceId": "d04",
      "tagId": "temperature",
      "unit": "°C",
      "samples": [
        {
          "time": 1792452900000,
          "value": 24.6
        },
        {
          "time": 1792453200000,
          "value": 24.6
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 24.6
        },
        {
          "time": 1792454400000,
          "value": 24.6
        }
      ]
    },
    {
      "deviceId": "d04",
      "tagId": "humidity",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 61.6
        },
        {
          "time": 1792453200000,
          "value": 61.6
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 61.6
        },
        {
          "time": 1792454400000,
          "value": 61.6
        }
      ]
    },
    {
      "deviceId": "d05",
      "tagId": "power",
      "unit": "kW",
      "samples": [
        {
          "time": 1792452900000,
          "value": 0
        },
        {
          "time": 1792453200000,
          "value": 0
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 0
        },
        {
          "time": 1792454400000,
          "value": 0
        }
      ]
    },
    {
      "deviceId": "d05",
      "tagId": "voltage",
      "unit": "V",
      "samples": [
        {
          "time": 1792452900000,
          "value": 220.0
        },
        {
          "time": 1792453200000,
          "value": 220.0
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 220.0
        },
        {
          "time": 1792454400000,
          "value": 220.0
        }
      ]
    },
    {
      "deviceId": "d06",
      "tagId": "power",
      "unit": "kW",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1.6
        },
        {
          "time": 1792453200000,
          "value": 1.6
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1.6
        },
        {
          "time": 1792454400000,
          "value": 1.6
        }
      ]
    },
    {
      "deviceId": "d06",
      "tagId": "voltage",
      "unit": "V",
      "samples": [
        {
          "time": 1792452900000,
          "value": 220.2
        },
        {
          "time": 1792453200000,
          "value": 220.2
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 220.2
        },
        {
          "time": 1792454400000,
          "value": 220.2
        }
      ]
    },
    {
      "deviceId": "d07",
      "tagId": "power",
      "unit": "kW",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1.8
        },
        {
          "time": 1792453200000,
          "value": 1.8
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1.8
        },
        {
          "time": 1792454400000,
          "value": 1.8
        }
      ]
    },
    {
      "deviceId": "d07",
      "tagId": "voltage",
      "unit": "V",
      "samples": [
        {
          "time": 1792452900000,
          "value": 220.4
        },
        {
          "time": 1792453200000,
          "value": 220.4
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 220.4
        },
        {
          "time": 1792454400000,
          "value": 220.4
        }
      ]
    },
    {
      "deviceId": "d08",
      "tagId": "power",
      "unit": "kW",
      "samples": [
        {
          "time": 1792452900000,
          "value": 2.0
        },
        {
          "time": 1792453200000,
          "value": 2.0
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 2.0
        },
        {
          "time": 1792454400000,
          "value": 2.0
        }
      ]
    },
    {
      "deviceId": "d08",
      "tagId": "voltage",
      "unit": "V",
      "samples": [
        {
          "time": 1792452900000,
          "value": 220.6
        },
        {
          "time": 1792453200000,
          "value": 220.6
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 220.6
        },
        {
          "time": 1792454400000,
          "value": 220.6
        }
      ]
    },
    {
      "deviceId": "d09",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d10",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d11",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d12",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d13",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d13",
      "tagId": "brightness",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 75.0
        },
        {
          "time": 1792453200000,
          "value": 75.0
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 75.0
        },
        {
          "time": 1792454400000,
          "value": 75.0
        }
      ]
    },
    {
      "deviceId": "d14",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d14",
      "tagId": "brightness",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 75.2
        },
        {
          "time": 1792453200000,
          "value": 75.2
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 75.2
        },
        {
          "time": 1792454400000,
          "value": 75.2
        }
      ]
    },
    {
      "deviceId": "d15",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d15",
      "tagId": "brightness",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 75.4
        },
        {
          "time": 1792453200000,
          "value": 75.4
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 75.4
        },
        {
          "time": 1792454400000,
          "value": 75.4
        }
      ]
    },
    {
      "deviceId": "d16",
      "tagId": "status",
      "unit": "",
      "samples": [
        {
          "time": 1792452900000,
          "value": 1
        },
        {
          "time": 1792453200000,
          "value": 1
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 1
        },
        {
          "time": 1792454400000,
          "value": 1
        }
      ]
    },
    {
      "deviceId": "d16",
      "tagId": "brightness",
      "unit": "%",
      "samples": [
        {
          "time": 1792452900000,
          "value": 75.6
        },
        {
          "time": 1792453200000,
          "value": 75.6
        },
        {
          "time": 1792453500000,
          "value": null
        },
        {
          "time": 1792453800000,
          "value": 0
        },
        {
          "time": 1792454100000,
          "value": 75.6
        },
        {
          "time": 1792454400000,
          "value": 75.6
        }
      ]
    }
  ],
  "alarms": [
    {
      "id": "a01",
      "deviceId": "d01",
      "message": "教学样本：温度提醒；不表示真实校园故障",
      "status": "SAMPLE_ACTIVE",
      "level": "NOTICE",
      "time": 1792454400000,
      "simulated": true
    }
  ]
};
