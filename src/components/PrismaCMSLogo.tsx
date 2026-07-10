const ASCII_LOGO = `####  ####  ###   ###  #   #   ##
#  #  #  #   #   #     ## ##  #  #
####  ####   #    ###  # # #  ####
#     # #    #      #  #   #  #  #
#     #  #  ###  ###   #   #  #  #

    #     ##   ###    ###
    #    #  #  #  #  #
    #    ####  ###    ###
    #    #  #  #  #     #
    ###  #  #  ###   ###`

export default function PrismaCMSLogo() {
  return (
    <div className="prisma-cms-logo" aria-label="PRISMA LABS">
      <pre className="prisma-cms-logo__ascii" aria-hidden="true">
        {ASCII_LOGO}
      </pre>
    </div>
  )
}
