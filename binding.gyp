{
	'targets': [
		{
			'target_name': 'hc',
			'include_dirs': [
				'<!(node -e "require(\'nan\')")',
			],
			'sources': [
				'cc/__.cc',
				'cc/disk.cc',
				'cc/errno.h',
				'cc/time.cc',
				'cc/utils.cc',
				'cc/utils.h',
			],
		},
	],
}